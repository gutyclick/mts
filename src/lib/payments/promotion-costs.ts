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
    const claim = await db.rpc("simcoins_claim_cost_refresh");
    refreshToken = claim.error ? null : z.uuid().nullable().parse(claim.data);
    if (!refreshToken) return costs;
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
        return costs
          .filter(
            (cost) =>
              !refreshed.some((fresh) => fresh.plan_id === cost.plan_id),
          )
          .concat(refreshed);
    }
  } catch {
    /* Stale costs remain ineligible; never assume a wholesale price. */
  } finally {
    if (refreshToken)
      await db.rpc("simcoins_release_cost_refresh", { p_token: refreshToken });
  }
  return costs;
}
