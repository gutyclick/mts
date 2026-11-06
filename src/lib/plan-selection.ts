import type { Plan } from "./plan-utils.ts";
import { connectivityMode, type ConnectivityMode } from "./catalog-curation.ts";

export type PlanFamily = {
  dataGb: number;
  allowance: string;
  minDays: number;
  minPriceCents: number;
  plans: Plan[];
};

function comparePrice(a: Plan, b: Plan) {
  return a.retailPriceCents! - b.retailPriceCents! || a.id.localeCompare(b.id);
}

/** Publication and commercial approval are the caller's responsibility. */
function validPlans(plans: Plan[]): Plan[] {
  const byId = new Map<string, Plan>();
  for (const plan of [...plans]
    .filter(
      (p) =>
        p != null &&
        typeof p.id === "string" &&
        p.id.length > 0 &&
        p.kind === "fixed" &&
        Number.isFinite(p.dataGb) &&
        p.dataGb > 0 &&
        Number.isSafeInteger(p.days) &&
        p.days > 0 &&
        Number.isSafeInteger(p.retailPriceCents) &&
        p.retailPriceCents! > 0 &&
        p.details?.dataGb === p.dataGb &&
        p.details?.days === p.days,
    )
    .sort(comparePrice)) {
    if (!byId.has(plan.id)) byId.set(plan.id, plan);
  }
  return [...byId.values()];
}

export function buildPlanFamilies(plans: Plan[]): PlanFamily[] {
  const groups = new Map<number, Plan[]>();
  for (const plan of validPlans(plans)) {
    const group = groups.get(plan.dataGb) ?? [];
    group.push(plan);
    groups.set(plan.dataGb, group);
  }
  return [...groups]
    .sort(([a], [b]) => a - b)
    .map(([dataGb, group]) => {
      const sorted = group.sort(
        (a, b) => a.days - b.days || comparePrice(a, b),
      );
      return {
        dataGb,
        allowance: sorted[0].allowance,
        minDays: sorted[0].days,
        minPriceCents: Math.min(...sorted.map((p) => p.retailPriceCents!)),
        plans: sorted,
      };
    });
}

export function availableDurationOptions(
  plans: Plan[],
  dataGb: number,
  mode: string = "standard",
): number[] {
  return [
    ...new Set(
      validPlans(plans)
        .filter((p) => p.dataGb === dataGb && connectivityMode(p) === mode)
        .map((p) => p.days),
    ),
  ].sort((a, b) => a - b);
}

export function availableVariantOptions(
  plans: Plan[],
  dataGb: number,
  days: number,
): { id: ConnectivityMode }[] {
  const modes = new Set(
    validPlans(plans)
      .filter((p) => p.dataGb === dataGb && p.days === days)
      .map(connectivityMode),
  );
  return (["standard", "premium", "iij", "usip", "nonhkip", "myip"] as const)
    .filter((id) => modes.has(id))
    .map((id) => ({ id }));
}

export function resolvePlanSelection(
  plans: Plan[],
  selection: {
    dataGb: number;
    days?: number;
    mode?: string;
    planId?: string;
  },
): Plan | undefined {
  const candidates = validPlans(plans).filter(
    (p) =>
      p.dataGb === selection.dataGb &&
      (selection.days === undefined || p.days === selection.days) &&
      (selection.mode === undefined || connectivityMode(p) === selection.mode),
  );
  const exact =
    selection.planId && candidates.find((p) => p.id === selection.planId);
  if (exact) return exact;
  const mode = selection.mode ?? "standard";
  return candidates
    .filter((p) => connectivityMode(p) === mode)
    .sort((a, b) => a.days - b.days || comparePrice(a, b))[0];
}

export function selectDefaultPlan(
  plans: Plan[],
  initialPlanId?: string,
  initialDays?: number,
): Plan | undefined {
  const valid = validPlans(plans);
  const exact =
    initialPlanId &&
    valid.find(
      (p) =>
        p.id === initialPlanId &&
        (initialDays === undefined || p.days === initialDays),
    );
  if (exact) return exact;
  const first = buildPlanFamilies(valid)[0];
  if (!first) return undefined;
  if (initialDays !== undefined) {
    const requested = valid
      .filter(
        (p) => p.days === initialDays && connectivityMode(p) === "standard",
      )
      .sort((a, b) => a.dataGb - b.dataGb || comparePrice(a, b))[0];
    if (requested) return requested;
  }
  return (
    resolvePlanSelection(valid, { dataGb: first.dataGb }) ?? first.plans[0]
  );
}
