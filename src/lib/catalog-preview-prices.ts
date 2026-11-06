import proposal from "../data/catalog-preview-prices.json" with { type: "json" };
import { catalogPreviewEnabled } from "./catalog-preview.ts";
import type { Plan } from "./plan-utils";

/** Approved retail-only proposal. Never changes deployed prices or recorded orders. */
export function applyPreviewPrices(
  plans: Plan[],
  env: Record<string, string | undefined>,
): Plan[] {
  if (!catalogPreviewEnabled(env)) return plans;
  return plans.map((plan) => {
    const change = (
      proposal.prices as Record<
        string,
        { previousCents: number; proposedCents: number }
      >
    )[plan.id];
    if (!change) return plan;
    if (
      plan.retailPriceCents !== change.previousCents &&
      plan.retailPriceCents !== change.proposedCents
    )
      throw new Error(`Local price proposal is stale for ${plan.id}`);
    return { ...plan, retailPriceCents: change.proposedCents };
  });
}
