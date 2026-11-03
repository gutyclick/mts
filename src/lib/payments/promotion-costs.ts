import "server-only";
import { z } from "zod";
import { checkoutDatabase } from "./checkout-server";
import { esimAccess } from "../integrations/esimaccess-server";
import { compareProviderCatalog } from "../integrations/esimaccess-catalog";

export const promotionCostSchema = z.object({
  plan_id: z.string(),
  wholesale_unit_units: z.coerce
    .number()
    .int()
    .nonnegative()
    .max(Number.MAX_SAFE_INTEGER),
  observed_at: z.string(),
});
type Plan = {
  id: string;
  allowance: string;
  days: number;
  coverage_code: string;
};
type Cost = z.infer<typeof promotionCostSchema>;
const planSchema = z.object({
  id: z.string(),
  allowance: z.string(),
  days: z.number().int(),
  coverage_code: z.string(),
});
// Shared source of verified wholesale costs for promotional profitability checks.
// Refreshing costs never modifies selling prices or places an eSIM order.
export async function refreshPromotionCosts(
  plans: Plan[],
  costs: Cost[],
  maxAgeSeconds: number,
): Promise<Cost[]> {
  const freshAfter = Date.now() - maxAgeSeconds * 1000;
  if (
    !plans.some(
      (plan) =>
        !costs.some(
          (cost) =>
            cost.plan_id === plan.id &&
            Date.parse(cost.observed_at) > freshAfter,
        ),
    )
  )
    return costs;
  const db = checkoutDatabase();
  let refreshToken: string | null = null;
  try {
    const claim = await db.rpc("promotion_claim_cost_refresh");
    refreshToken = claim.error ? null : z.uuid().nullable().parse(claim.data);
    if (!refreshToken) {
      // Another checkout may have read stale rows just before the refresh saved
      // them. Re-read rather than rejecting a valid coupon with that old array.
      for (let attempt = 0; attempt < 12; attempt++) {
        const latest = await db
          .from("simcoins_private_costs")
          .select("plan_id,wholesale_unit_units,observed_at")
          .in(
            "plan_id",
            plans.map((plan) => plan.id),
          );
        if (!latest.error) {
          const parsed = z.array(promotionCostSchema).parse(latest.data);
          if (
            plans.every((plan) =>
              parsed.some(
                (cost) =>
                  cost.plan_id === plan.id &&
                  Date.parse(cost.observed_at) > freshAfter,
              ),
            )
          )
            return costs
              .filter((cost) => !plans.some((plan) => plan.id === cost.plan_id))
              .concat(parsed);
        }
        if (attempt < 11)
          await new Promise((resolve) => setTimeout(resolve, 500));
      }
      return costs;
    }
    // The supplier returns its whole catalog. Verify and persist all published
    // identities in that one response, so the global cooldown does not block
    // the next customer simply because their cart contains a different plan.
    const catalog: Plan[] = [];
    for (let offset = 0; ; offset += 500) {
      if (offset >= 20000) throw Error("promotion_catalog_limit");
      const page = await db
        .from("catalog_plans")
        .select("id,allowance,days,coverage_code")
        .eq("is_published", true)
        .eq("kind", "fixed")
        .order("id")
        .range(offset, offset + 499);
      if (page.error) throw Error("promotion_catalog_unavailable");
      const rows = z.array(planSchema).parse(page.data);
      catalog.push(...rows);
      if (rows.length < 500) break;
    }
    const remote = await esimAccess().privateCostPackages();
    const identity = compareProviderCatalog(
      catalog.map((plan) => ({
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
      const savedCosts: typeof refreshed = [];
      for (let offset = 0; offset < refreshed.length; offset += 500) {
        const batch = refreshed.slice(offset, offset + 500);
        const saved = await db
          .from("simcoins_private_costs")
          .upsert(batch, { onConflict: "plan_id" });
        if (!saved.error) savedCosts.push(...batch);
      }
      if (savedCosts.length)
        return costs
          .filter(
            (cost) =>
              !savedCosts.some((fresh) => fresh.plan_id === cost.plan_id),
          )
          .concat(
            savedCosts.filter((cost) =>
              plans.some((plan) => plan.id === cost.plan_id),
            ),
          );
    }
  } catch {
    /* Stale costs remain ineligible; never assume a wholesale price. */
  } finally {
    if (refreshToken)
      await db.rpc("simcoins_release_cost_refresh", { p_token: refreshToken });
  }
  return costs;
}
