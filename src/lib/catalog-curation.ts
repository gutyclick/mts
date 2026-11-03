import type { Plan } from "./plan-utils";

export type CommercialCategory = "basic" | "essential" | "plus" | "max";
export type ConnectivityMode =
  "standard" | "premium" | "iij" | "usip" | "nonhkip" | "myip";
export type PlanMerchandising = {
  plan_id: string;
  visibility: "auto" | "show" | "hide";
  commercial_category: CommercialCategory | null;
  recommendation_eligible: boolean;
  incident_block: boolean;
  main_priority: number | null;
};
export type ConnectivityEvidence = Record<
  string,
  { packageCode: string; breakoutIp: string; source: string }
>;
export type CuratedPlan = {
  plan: Plan;
  category: CommercialCategory;
  recommended: boolean;
  reasons: string[];
};
export type CuratedCatalog = {
  modes: {
    id: string;
    label: { es: string; en: string };
    description: { es: string; en: string };
    plans: CuratedPlan[];
    secondaryPlans: Plan[];
  }[];
  defaultMode: string;
  decisions: { planId: string; selected: boolean; reason: string }[];
};
export const curationPolicy = {
  version: 1,
  categories: [
    { id: "basic", min: 1, max: 3, targetGb: 1, targetDays: 7, minDays: 7 },
    {
      id: "essential",
      min: 3,
      max: 6,
      targetGb: 5,
      targetDays: 30,
      minDays: 15,
    },
    { id: "plus", min: 6, max: 20, targetGb: 10, targetDays: 30, minDays: 15 },
    {
      id: "max",
      min: 20,
      max: Infinity,
      targetGb: 20,
      targetDays: 30,
      minDays: 15,
    },
  ] as const,
  maximumPrimaryDays: 31,
};
export function connectivityMode(plan: Pick<Plan, "id">): ConnectivityMode {
  for (const mode of ["premium", "iij", "usip", "nonhkip", "myip"] as const)
    if (new RegExp(`_${mode}(?:_|$)`, "i").test(plan.id)) return mode;
  return "standard";
}
function networkIdentity(p: Plan) {
  return JSON.stringify(
    (p.details?.networks ?? [])
      .map(
        (n) =>
          `${n.countryCode ?? n.countryName}:${n.operators
            .map((o) => o.name.toLowerCase())
            .sort()
            .join("|")}`,
      )
      .sort(),
  );
}
function technicalDifference(a: Plan, b: Plan, evidence: ConnectivityEvidence) {
  const left = evidence[a.id]?.breakoutIp,
    right = evidence[b.id]?.breakoutIp;
  return (
    networkIdentity(a) !== networkIdentity(b) ||
    (!!left && !!right && left !== right)
  );
}
export function isCommerciallyAllowed(
  planId: string,
  overrides: PlanMerchandising[],
) {
  const rule = overrides.find((o) => o.plan_id === planId);
  return !rule?.incident_block && rule?.visibility !== "hide";
}
/** Input plans must already pass publication and current provider availability checks. No prices are modified. */
export function curateCatalog(input: {
  plans: Plan[];
  destinationCode: string;
  destinationType: "country" | "region";
  overrides?: PlanMerchandising[];
  approvedModes?: string[];
  evidence?: ConnectivityEvidence;
}): CuratedCatalog {
  const {
    plans,
    destinationCode,
    destinationType,
    overrides = [],
    evidence = {},
  } = input;
  const rules = new Map(overrides.map((o) => [o.plan_id, o]));
  const decisions = new Map<
    string,
    { planId: string; selected: boolean; reason: string }
  >();
  const candidates = plans.filter((p) => {
    const d = p.details;
    const reason = !isCommerciallyAllowed(p.id, overrides)
      ? "manual_block"
      : p.kind !== "fixed"
        ? "not_fixed"
        : !Number.isSafeInteger(p.retailPriceCents) ||
            !p.retailPriceCents ||
            p.retailPriceCents <= 0
          ? "missing_retail_price"
          : !d || d.dataGb !== p.dataGb || d.days !== p.days
            ? "technical_identity_missing"
            : destinationType === "country" &&
                (!d.coverage.includes(destinationCode) ||
                  p.coverageCode !== destinationCode)
              ? "destination_mismatch"
              : destinationType === "region" &&
                  p.coverageCode !== destinationCode
                ? "destination_mismatch"
                : !d.networks.some(
                      (n) =>
                        n.operators.length > 0 &&
                        (destinationType === "region" ||
                          n.countryCode === destinationCode),
                    )
                  ? "network_unknown"
                  : p.dataGb < 1
                    ? "secondary_small_allowance"
                    : p.days > curationPolicy.maximumPrimaryDays
                      ? "secondary_long_stay"
                      : null;
    decisions.set(p.id, {
      planId: p.id,
      selected: false,
      reason: reason ?? "not_selected",
    });
    return !reason || reason === "secondary_long_stay";
  });
  const requested = [...new Set(input.approvedModes ?? ["standard"])]
    .filter((m) =>
      ["standard", "premium", "iij", "usip", "nonhkip", "myip"].includes(m),
    )
    .slice(0, 3);
  const allowedModes = requested.length ? requested : ["standard"];
  const modes: CuratedCatalog["modes"] = [];
  for (const mode of allowedModes) {
    const rawGroup = candidates.filter((p) => connectivityMode(p) === mode);
    // Approval alone cannot turn an identical variant into a meaningful alternative.
    const standard = plans.filter(
      (p) =>
        connectivityMode(p) === "standard" &&
        p.details?.dataGb === p.dataGb &&
        p.details?.days === p.days &&
        p.coverageCode === destinationCode &&
        (destinationType === "region" ||
          p.details.coverage.includes(destinationCode)) &&
        p.details.networks.some((n) => n.operators.length > 0),
    );
    const group =
      mode === "standard"
        ? rawGroup
        : rawGroup.filter((p) =>
            standard.some(
              (s) =>
                p.dataGb === s.dataGb &&
                p.days === s.days &&
                technicalDifference(p, s, evidence),
            ),
          );
    if (!group.length) continue;
    const selected: CuratedPlan[] = [];
    for (const category of curationPolicy.categories) {
      const possible = group.filter((p) => {
        if (p.days > curationPolicy.maximumPrimaryDays) return false;
        const rule = rules.get(p.id);
        if (rule?.commercial_category)
          return rule.commercial_category === category.id;
        return (
          p.dataGb >= category.min &&
          p.dataGb < category.max &&
          p.days >= category.minDays
        );
      });
      possible.sort((a, b) => {
        const ra = rules.get(a.id),
          rb = rules.get(b.id);
        return (
          (ra?.main_priority ?? 101) - (rb?.main_priority ?? 101) ||
          Number(rb?.visibility === "show") -
            Number(ra?.visibility === "show") ||
          Number(a.details?.activation !== "network") -
            Number(b.details?.activation !== "network") ||
          Math.abs(a.dataGb - category.targetGb) -
            Math.abs(b.dataGb - category.targetGb) ||
          Math.abs(a.days - category.targetDays) -
            Math.abs(b.days - category.targetDays) ||
          a.retailPriceCents! - b.retailPriceCents! ||
          a.id.localeCompare(b.id)
        );
      });
      const p = possible.find(
        (p) =>
          !selected.some(
            (s) => s.plan.dataGb === p.dataGb && s.plan.days === p.days,
          ),
      );
      if (!p) continue;
      const manual = rules.get(p.id);
      const reason =
        manual?.main_priority || manual?.visibility === "show"
          ? "manual_priority"
          : "closest_category_reference";
      selected.push({
        plan: p,
        category: category.id,
        recommended:
          category.id === "essential" &&
          (manual?.recommendation_eligible ?? true),
        reasons: [
          reason,
          "verified_destination_and_network",
          "existing_retail_price",
        ],
      });
      decisions.set(p.id, { planId: p.id, selected: true, reason });
    }
    const secondaryPlans = group
      .filter((p) => p.days > curationPolicy.maximumPrimaryDays)
      .sort(
        (a, b) =>
          (rules.get(a.id)?.main_priority ?? 101) -
            (rules.get(b.id)?.main_priority ?? 101) ||
          a.retailPriceCents! - b.retailPriceCents! ||
          a.id.localeCompare(b.id),
      )
      .filter(
        (p, i, list) =>
          list.findIndex(
            (other) => other.dataGb === p.dataGb && other.days === p.days,
          ) === i,
      )
      .sort((a, b) => a.days - b.days || a.dataGb - b.dataGb);
    if (!selected.length && !secondaryPlans.length) continue;
    const localIp = [...selected.map((p) => p.plan), ...secondaryPlans].every(
      (p) => evidence[p.id]?.breakoutIp === destinationCode,
    );
    const networkDifference = [
      ...selected.map((p) => p.plan),
      ...secondaryPlans,
    ].every((p) =>
      standard.some(
        (s) =>
          p.dataGb === s.dataGb &&
          p.days === s.days &&
          networkIdentity(p) !== networkIdentity(s),
      ),
    );
    const label =
      mode === "standard"
        ? { es: "Estándar", en: "Standard" }
        : localIp
          ? { es: "IP local", en: "Local IP" }
          : networkDifference
            ? { es: "Otras redes", en: "Alternative networks" }
            : { es: "Otra conexión", en: "Alternative connection" };
    const description =
      mode === "standard"
        ? {
            es: "Consulta los operadores de cada plan.",
            en: "Check the operators included in each plan.",
          }
        : localIp
          ? {
              es: "Salida a internet con IP del destino. Revisa sus operadores y activación.",
              en: "Internet exits using a destination IP. Check operators and activation.",
            }
          : networkDifference
            ? {
                es: "Una configuración de operadores diferente. La señal depende del lugar y del equipo.",
                en: "A different operator configuration. Signal depends on location and device.",
              }
            : {
                es: "Una salida a internet diferente. Revisa la red y la activación de cada plan.",
                en: "A different internet routing configuration. Check each plan’s network and activation.",
              };
    modes.push({
      id: mode,
      label,
      description,
      plans: selected,
      secondaryPlans,
    });
  }
  return {
    modes,
    defaultMode: modes[0]?.id ?? "standard",
    decisions: [...decisions.values()].sort((a, b) =>
      a.planId.localeCompare(b.planId),
    ),
  };
}
