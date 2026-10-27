import "server-only";
import { z } from "zod";
import { checkoutDatabase } from "../payments/checkout-server";
import { sha256 } from "../payments/checkout-core";
import { convertUsdMinor, usdRate, currencies } from "../currency";
import { esimAccess } from "../integrations/esimaccess-server";
import { paymentMode } from "../payments/checkout-mode";
import { compareProviderCatalog } from "../integrations/esimaccess-catalog";
import { buildSimcoinsQuote } from "./engine";
import { simcoinsFlags } from "./config";
import { getCustomerSimcoins, getSimcoinsSettings } from "./server";
import {
  canonicalSimcoinsCart,
  simcoinsPaymentTotal,
  type SimcoinsCheckoutQuote,
} from "./checkout";
import type { CartLine } from "../cart";
import type { Currency } from "../currency";

export function simcoinsCheckoutEnabled() {
  const flags = simcoinsFlags();
  return (
    flags.enabled &&
    paymentMode(process.env) === "live" &&
    flags.persistenceReady &&
    (flags.earnEnabled || flags.redeemEnabled)
  );
}

const planSchema = z.object({
  id: z.string(),
  destination_slug: z.string(),
  allowance: z.string(),
  days: z.number().int(),
  coverage_code: z.string(),
  retail_price_cents: z.number().int().positive(),
});
const costSchema = z.object({
  plan_id: z.string(),
  wholesale_unit_units: z.coerce
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER),
  observed_at: z.string(),
});

export async function createSimcoinsCheckoutQuote(
  userId: string,
  input: {
    lines: CartLine[];
    currency: Currency;
    fxQuoteId: string | null;
    useCoins: boolean;
  },
): Promise<SimcoinsCheckoutQuote | null> {
  if (!simcoinsCheckoutEnabled()) return null;
  const db = checkoutDatabase();
  const flags = simcoinsFlags();
  const [
    config,
    customer,
    policy,
    plansResult,
    eligibilityResult,
    costsResult,
    fx,
  ] = await Promise.all([
    getSimcoinsSettings(),
    getCustomerSimcoins(userId),
    db
      .from("simcoins_program_settings")
      .select("enabled,earn_enabled,redeem_enabled")
      .eq("id", true)
      .single(),
    db
      .from("catalog_plans")
      .select(
        "id,destination_slug,allowance,days,coverage_code,retail_price_cents",
      )
      .in(
        "id",
        input.lines.map((line) => line.planId),
      )
      .eq("is_published", true),
    db
      .from("simcoins_product_eligibility")
      .select("plan_id,earn_enabled,redeem_enabled")
      .in(
        "plan_id",
        input.lines.map((line) => line.planId),
      ),
    db
      .from("simcoins_private_costs")
      .select("plan_id,wholesale_unit_units,observed_at")
      .in(
        "plan_id",
        input.lines.map((line) => line.planId),
      ),
    input.currency === "USD"
      ? Promise.resolve({ data: null, error: null })
      : db
          .from("fx_snapshots")
          .select("id,rates,expires_at")
          .eq("id", input.fxQuoteId!)
          .gt("expires_at", new Date().toISOString())
          .single(),
  ]);
  if (policy.error || !policy.data?.enabled) return null;
  const policyFlags = z
    .object({
      enabled: z.boolean(),
      earn_enabled: z.boolean(),
      redeem_enabled: z.boolean(),
    })
    .parse(policy.data);
  if (
    plansResult.error ||
    eligibilityResult.error ||
    costsResult.error ||
    !customer.configured
  )
    throw Error("simcoins_unavailable");
  const eligibility = z
    .array(
      z.object({
        plan_id: z.string(),
        earn_enabled: z.boolean(),
        redeem_enabled: z.boolean(),
      }),
    )
    .parse(eligibilityResult.data);
  const participatingIds = new Set(
    eligibility
      .filter(
        (item) =>
          (flags.earnEnabled &&
            policyFlags.earn_enabled &&
            item.earn_enabled) ||
          (flags.redeemEnabled &&
            policyFlags.redeem_enabled &&
            item.redeem_enabled),
      )
      .map((item) => item.plan_id),
  );
  if (!participatingIds.size) return null;
  if (fx.error || (input.currency !== "USD" && !fx.data))
    throw Error("quote_expired");
  const rate =
    input.currency === "USD"
      ? usdRate
      : z
          .string()
          .regex(/^\d{1,16}$/)
          .parse(fx.data?.rates[input.currency]);
  const plans = z.array(planSchema).parse(plansResult.data);
  if (
    plans.length !== input.lines.length ||
    input.lines.some(
      (line) =>
        !plans.some(
          (plan) =>
            plan.id === line.planId &&
            plan.destination_slug === line.destination,
        ),
    )
  )
    throw Error("unavailable_plan");
  let costs = z.array(costSchema).parse(costsResult.data);
  const freshAfter = Date.now() - config.settings.costsMaxAgeSeconds * 1000;
  if (
    plans
      .filter((plan) => participatingIds.has(plan.id))
      .some(
        (plan) =>
          !costs.some(
            (cost) =>
              cost.plan_id === plan.id &&
              Date.parse(cost.observed_at) > freshAfter,
          ),
      )
  ) {
    let refreshToken: string | null = null;
    try {
      const claim = await db.rpc("simcoins_claim_cost_refresh");
      refreshToken = claim.error ? null : z.uuid().nullable().parse(claim.data);
      if (!refreshToken) throw Error("refresh_deferred");
      const remote = await esimAccess().privateCostPackages();
      const identity = compareProviderCatalog(
        plans.map((plan) => ({
          id: plan.id,
          allowance: plan.allowance,
          days: plan.days,
          coverageCode: plan.coverage_code,
        })),
        remote,
      );
      const observedAt = new Date().toISOString();
      const refreshed = identity.matches.flatMap((match) => {
        const item = remote.find((entry) => entry.slug === match.providerSlug);
        return item?.wholesaleUnitUnits != null
          ? [
              {
                plan_id: match.planId,
                wholesale_unit_units: item.wholesaleUnitUnits,
                observed_at: observedAt,
                source_ref: "esimaccess:package/list",
              },
            ]
          : [];
      });
      if (refreshed.length) {
        const saved = await db
          .from("simcoins_private_costs")
          .upsert(refreshed, { onConflict: "plan_id" });
        if (!saved.error)
          costs = costs
            .filter(
              (cost) =>
                !refreshed.some((fresh) => fresh.plan_id === cost.plan_id),
            )
            .concat(refreshed);
      }
    } catch {
      /* Missing fresh verified costs make affected lines ineligible. */
    } finally {
      if (refreshToken)
        await db.rpc("simcoins_release_cost_refresh", {
          p_token: refreshToken,
        });
    }
  }
  const engineInput = {
    lines: input.lines.map((line) => {
      const plan = plans.find((item) => item.id === line.planId)!;
      const optIn = eligibility.find((item) => item.plan_id === line.planId);
      const cost = costs.find((item) => item.plan_id === line.planId);
      return {
        planId: line.planId,
        quantity: line.quantity,
        grossUnitCents: plan.retail_price_cents,
        wholesaleUnitUnits: cost?.wholesale_unit_units ?? null,
        costObservedAt: cost?.observed_at ?? null,
        earnEnabled:
          flags.earnEnabled &&
          policyFlags.earn_enabled &&
          optIn?.earn_enabled === true,
        redeemEnabled:
          flags.redeemEnabled &&
          policyFlags.redeem_enabled &&
          optIn?.redeem_enabled === true,
      };
    }),
    currency: input.currency,
    fxRate: rate,
    currencyDecimals: currencies.find((item) => item.code === input.currency)!
      .decimals,
    availableCoins: customer.wallet?.availableCoins ?? 0,
    requestedCoins: input.useCoins ? (customer.wallet?.availableCoins ?? 0) : 0,
    eligibleSpendCents: customer.wallet?.eligibleSpendCents ?? 0,
    settings: config.settings,
    levels: config.levels,
  };
  let snapshot = buildSimcoinsQuote(engineInput);
  const roundingBlocked = snapshot.lines.some(
    (line) =>
      line.redeemUnitCoins > 0 &&
      convertUsdMinor(line.netUnitCents, input.currency, rate) >=
        convertUsdMinor(line.grossUnitCents, input.currency, rate),
  );
  if (roundingBlocked)
    snapshot = buildSimcoinsQuote({ ...engineInput, requestedCoins: 0 });
  // An ineligible offer must not turn an otherwise ordinary checkout into an error.
  // The zero-rate welcome purchase still participates when it has qualifying spend.
  if (snapshot.eligibleSpendCents === 0 && snapshot.redeemedCoins === 0) {
    // Record the decision privately without enrolling an ineligible order or blocking payment.
    try {
      await db.rpc("simcoins_record_exclusion", {
        p_user: userId,
        p_cart_hash: sha256(canonicalSimcoinsCart(input.lines)),
        p_snapshot: snapshot,
      });
    } catch {
      /* Optional decision audit must not interrupt ordinary payment. */
    }
    return null;
  }
  const paymentTotal = simcoinsPaymentTotal(
    snapshot.lines,
    input.currency,
    rate,
  );
  if (paymentTotal < 1) throw Error("simcoins_unavailable");
  const saved = await db.rpc("simcoins_create_quote", {
    p_user: userId,
    p_cart_hash: sha256(canonicalSimcoinsCart(input.lines)),
    p_currency: input.currency,
    p_fx_quote: input.fxQuoteId,
    p_snapshot: snapshot,
  });
  if (saved.error) throw Error("simcoins_unavailable");
  const quote = z
    .object({ id: z.uuid(), expiresAt: z.string() })
    .parse(saved.data);
  return {
    ...quote,
    currency: input.currency,
    paymentTotal,
    earnedCoins: snapshot.earnedCoins,
    redeemedCoins: snapshot.redeemedCoins,
    maxRedeemCoins: roundingBlocked ? 0 : snapshot.maxRedeemCoins,
    firstPurchase:
      snapshot.levelId === "traveler" && snapshot.eligibleSpendCents > 0,
    reasons: [
      ...(roundingBlocked ? ["currency_rounding"] : []),
      ...new Set(
        snapshot.lines
          .map((line) => line.reason)
          .filter((reason): reason is string => !!reason),
      ),
    ],
  };
}

export async function reserveSimcoinsCheckout(
  orderId: string,
  userId: string | null,
  quoteId: string,
) {
  if (!simcoinsCheckoutEnabled() || !userId)
    throw Error("simcoins_unavailable");
  const result = await checkoutDatabase().rpc("simcoins_prepare_order", {
    p_order: orderId,
    p_user: userId,
    p_quote: quoteId,
  });
  if (result.error) throw Error("simcoins_quote_expired");
}
