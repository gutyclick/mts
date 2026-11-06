import policy from "../data/regional-catalog-policy.json" with { type: "json" };
import type { Destination } from "./catalog.ts";

/** Discovery only: never remaps a destination URL, code or underlying SKU. */
export function applyRegionalPolicy(
  destinations: Destination[],
): Destination[] {
  const groups = policy.groups;
  return destinations.flatMap((destination) => {
    const group = groups.find((item) =>
      item.canonicalSlugs.includes(destination.slug),
    );
    // Local discovery is an explicit regional shortlist: route bundles and
    // unselected subregions must not silently reintroduce competing catalogs.
    if (!group) return destination.type === "region" ? [] : [destination];
    if (destination.slug !== group.sourceSlug) return [];
    // Alias names describe the family, not the suppressed offer's coverage count.
    const aliases = [
      ...new Set([
        ...destination.aliases,
        ...group.searchAliases,
        group.displayName.es,
        group.displayName.en,
        destination.name.es,
        destination.name.en,
      ]),
    ];
    return [{ ...destination, name: { ...group.displayName }, aliases }];
  });
}
