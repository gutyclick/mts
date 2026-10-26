import type { Destination } from "./catalog";
import type { Plan } from "./plan-utils";
import type { Locale } from "./i18n";

/** Suggest only published country pages explicitly present in these plans' coverage. */
export function relatedCoverageDestinations(
  destination: Destination,
  plans: Plan[],
  catalog: Destination[],
  locale: Locale,
  limit = 6,
): Destination[] {
  const occurrences = new Map<string, number>();
  for (const plan of plans) {
    for (const code of new Set(plan.details?.coverage ?? [])) {
      occurrences.set(code, (occurrences.get(code) ?? 0) + 1);
    }
  }
  return catalog
    .filter(
      (candidate) =>
        candidate.type === "country" &&
        candidate.planCount > 0 &&
        candidate.slug !== destination.slug &&
        occurrences.has(candidate.code),
    )
    .sort(
      (a, b) =>
        (occurrences.get(b.code) ?? 0) - (occurrences.get(a.code) ?? 0) ||
        a.name[locale].localeCompare(b.name[locale], locale),
    )
    .slice(0, Math.max(0, Math.min(limit, 6)));
}
