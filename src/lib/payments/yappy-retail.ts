import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { NextRequest } from "next/server";
import { authClient } from "../supabase/auth-server";
import { createYappyOrder } from "../integrations/yappy";
import {
  checkoutDatabase,
  paymentMode,
  paymentOrigin,
} from "./checkout-server";
import {
  browserCookie,
  checkoutRequestSchema,
  privateHash,
  resultPath,
  sha256,
  validBrowserToken,
} from "./checkout-core";
import { retailYappySettings, yappyContribution } from "./yappy-policy";
import { promotionCostSchema, refreshPromotionCosts } from "./promotion-costs";
import {
  reserveSimcoinsCheckout,
  simcoinsCheckoutEnabled,
} from "../simcoins/checkout-server";

export class RetailYappyError extends Error {
  constructor(
    public code: string,
    public status = 409,
  ) {
    super(code);
  }
}
const orderSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  billing_email: z.string(),
  livemode: z.boolean(),
  payment_total: z.number().int().nullable(),
  payment_currency: z.string().nullable(),
  stripe_session_id: z.string().nullable(),
});
export async function beginRetailYappy(request: NextRequest) {
  const live = paymentMode(process.env) === "live";
  const settings = retailYappySettings(process.env, live);
  if (!settings || settings.config.origin !== paymentOrigin())
    throw new RetailYappyError("yappy_unavailable", 503);
  if (
    request.headers.get("origin") !== paymentOrigin() ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    throw new RetailYappyError("invalid_request", 403);
  const browser = request.cookies.get(browserCookie)?.value;
  if (!validBrowserToken(browser))
    throw new RetailYappyError("cookies_required");
  if (Number(request.headers.get("content-length")) > 32768)
    throw new RetailYappyError("invalid_request", 413);
  const text = await request.text();
  if (text.length > 32768) throw new RetailYappyError("invalid_request", 413);
  let body: z.infer<typeof checkoutRequestSchema>;
  try {
    body = checkoutRequestSchema.parse(JSON.parse(text));
  } catch {
    throw new RetailYappyError("invalid_request", 400);
  }
  if (body.currency !== "USD" || body.fxQuoteId !== null)
    throw new RetailYappyError("yappy_usd_required");
  if (body.couponQuoteId && !live)
    throw new RetailYappyError("coupon_unavailable");
  const client = await authClient();
  const {
    data: { user },
    error: authError,
  } = await client.auth.getUser();
  if (authError && authError.name !== "AuthSessionMissingError")
    throw new RetailYappyError("account_unavailable", 503);
  if (user && (!user.email_confirmed_at || !user.email))
    throw new RetailYappyError("verify_email", 403);
  if (body.couponQuoteId && !user)
    throw new RetailYappyError("account_required", 403);
  const email = user?.email ?? body.email.trim().toLowerCase();
  const recipient = body.differentRecipient
    ? body.recipientEmail!.trim().toLowerCase()
    : email;
  const secret = process.env.CHECKOUT_REQUEST_SECRET;
  if (!secret || secret.length < 32)
    throw new RetailYappyError("yappy_unavailable", 503);
  const db = checkoutDatabase();
  const fingerprint = sha256(
    JSON.stringify({
      channel: "yappy-v1",
      email,
      recipient,
      user: user?.id ?? null,
      marketing: body.marketingOptIn,
      locale: body.locale,
      total: body.expectedTotal,
      paymentTotal: body.expectedPaymentTotal ?? body.expectedTotal,
      coupon: body.couponQuoteId ?? null,
      rewards: body.simcoinsQuoteId ?? null,
      legal: body.legalVersion,
      lines: [...body.lines].sort((a, b) => a.planId.localeCompare(b.planId)),
    }),
  );
  const created = await db.rpc("create_checkout_v3", {
    p_livemode: live,
    p_id: body.attemptId,
    p_user_id: user?.id ?? null,
    p_billing_email: email,
    p_recipient_email: recipient,
    p_marketing_opt_in: body.marketingOptIn,
    p_browser_hash: sha256(browser),
    p_ip_hash: privateHash(
      request.headers.get("x-vercel-forwarded-for") ??
        request.headers.get("x-forwarded-for") ??
        "local",
      secret,
    ),
    p_fingerprint: fingerprint,
    p_locale: body.locale,
    p_expected_total: body.expectedTotal,
    p_lines: body.lines,
  });
  if (created.error) {
    const code = [
      "checkout_rate_limit",
      "price_changed",
      "unavailable_plan",
      "attempt_conflict",
    ].find((x) => created.error!.message.includes(x));
    throw new RetailYappyError(
      code ?? "yappy_unavailable",
      code === "checkout_rate_limit" ? 429 : 409,
    );
  }
  let order = orderSchema.parse(created.data);
  if (order.livemode !== live) throw new RetailYappyError("attempt_conflict");
  if (order.status === "paid")
    return { url: resultPath(body.locale, order.id) };
  if (order.status !== "pending" || order.stripe_session_id)
    throw new RetailYappyError("attempt_conflict");
  // Never retry an ambiguous creation using a different provider reference.
  const prior = await db
    .from("checkout_yappy_attempts")
    .select("state")
    .eq("order_id", order.id)
    .maybeSingle();
  if (prior.error) throw new RetailYappyError("yappy_unavailable", 503);
  if (prior.data) throw new RetailYappyError("yappy_payment_pending");
  let claimed = false;
  try {
    const accepted = await db
      .from("checkout_legal_acceptances")
      .upsert(
        { order_id: order.id, version: body.legalVersion, locale: body.locale },
        { onConflict: "order_id,version", ignoreDuplicates: true },
      );
    if (accepted.error) throw Error("acceptance");
    if (body.simcoinsQuoteId)
      await reserveSimcoinsCheckout(
        order.id,
        user?.id ?? null,
        body.simcoinsQuoteId,
      );
    const expected = body.expectedPaymentTotal ?? body.expectedTotal;
    const prepared = await db.rpc(
      body.couponQuoteId
        ? "coupon_prepare_payment"
        : body.simcoinsQuoteId && simcoinsCheckoutEnabled()
          ? "simcoins_prepare_payment"
          : "prepare_checkout_payment",
      body.couponQuoteId
        ? {
            p_order: order.id,
            p_identity: privateHash(
              order.billing_email.trim().toLowerCase(),
              secret,
            ),
            p_quote: body.couponQuoteId,
            p_currency: "USD",
            p_fx_quote: null,
            p_expected: expected,
          }
        : body.simcoinsQuoteId
          ? {
              p_order: order.id,
              p_currency: "USD",
              p_quote: null,
              p_expected: expected,
            }
          : {
              p_id: order.id,
              p_currency: "USD",
              p_quote: null,
              p_expected: expected,
            },
    );
    if (prepared.error) throw new RetailYappyError("price_changed");
    order = orderSchema.parse(prepared.data);
    if (order.payment_currency !== "USD" || order.payment_total !== expected)
      throw new RetailYappyError("price_changed");
    const ids = body.lines.map((p) => p.planId);
    const [rawPlans, rawCosts] = await Promise.all([
      db
        .from("catalog_plans")
        .select("id,allowance,days,coverage_code")
        .in("id", ids)
        .eq("is_published", true),
      db
        .from("simcoins_private_costs")
        .select("plan_id,wholesale_unit_units,observed_at")
        .in("plan_id", ids),
    ]);
    if (rawPlans.error || rawCosts.error) throw Error("costs");
    const plans = z
      .array(
        z.object({
          id: z.string(),
          allowance: z.string(),
          days: z.number().int(),
          coverage_code: z.string(),
        }),
      )
      .parse(rawPlans.data);
    if (plans.length !== ids.length)
      throw new RetailYappyError("unavailable_plan");
    const costs = await refreshPromotionCosts(
      plans,
      z.array(promotionCostSchema).parse(rawCosts.data),
      300,
    );
    let totalCost = 0;
    for (const line of body.lines) {
      const cost = costs.find((c) => c.plan_id === line.planId);
      if (!cost || Date.now() - Date.parse(cost.observed_at) > 300000)
        throw Error("stale_cost");
      totalCost += cost.wholesale_unit_units * line.quantity;
    }
    if (
      !yappyContribution(
        expected,
        totalCost,
        settings.feeBps,
        settings.fixedCents,
      ).eligible
    )
      throw new RetailYappyError("yappy_insufficient_margin");
    const ref = randomBytes(8).toString("hex").slice(0, 15);
    const claim = await db.rpc("retail_yappy_claim", {
      p_order: order.id,
      p_ref: ref,
      p_amount: expected,
      p_domain: settings.config.domain,
      p_live: live,
    });
    if (claim.error) throw new RetailYappyError("yappy_payment_pending");
    claimed = true;
    const payment = await createYappyOrder(settings.config, {
      orderId: ref,
      totalCents: expected,
      taxCents: 0,
      ipnUrl: `${settings.config.origin}/api/payments/yappy/ipn`,
    });
    const bound = await db.rpc("retail_yappy_bind", {
      p_order: order.id,
      p_ref: ref,
      p_transaction: payment.transactionId,
    });
    if (bound.error || bound.data !== true) throw Error("binding");
    return {
      ...payment,
      orderId: order.id,
      resultUrl: resultPath(body.locale, order.id),
    };
  } catch (error) {
    await db.rpc(
      claimed ? "retail_yappy_review" : "retail_yappy_preparation_failed",
      { p_order: order.id },
    );
    if (claimed) throw new RetailYappyError("yappy_payment_pending");
    if (error instanceof RetailYappyError) throw error;
    throw new RetailYappyError("yappy_unavailable", 503);
  }
}
