import catalog from "../data/plans.json";
import type { Destination } from "./catalog";
import type { Plan } from "./plan-utils";

// Imported only by server routes. Client islands receive one destination's plans.
export function getPlans(destination: Destination): Plan[] {
  return (catalog as Record<string, Plan[]>)[destination.slug] ?? [];
}
