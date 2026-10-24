import catalog from "../data/plans.json";
import details from "../data/plan-details.json";
import type { Destination } from "./catalog";
import type { Plan, PlanDetails } from "./plan-utils";

// Imported only by server routes. Client islands receive one destination's plans.
export function getPlans(destination: Destination): Plan[] {
  return ((catalog as Record<string, Plan[]>)[destination.slug] ?? []).map(
    (plan) => ({
      ...plan,
      details: matchingDetails(plan),
    }),
  );
}
function matchingDetails(plan: Plan) {
  const detail = (details as Record<string, PlanDetails>)[plan.id];
  return detail?.dataGb === plan.dataGb && detail.days === plan.days
    ? detail
    : undefined;
}
