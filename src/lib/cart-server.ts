import "server-only";
import { getDestinations, getPublishedPlans } from "./catalog-server";
import type { CartLine, ResolvedCart } from "./cart";

export async function resolveCart(lines: CartLine[]): Promise<ResolvedCart> {
  const catalog = await getDestinations();
  const destinations = await Promise.all(
    [...new Set(lines.map((l) => l.destination))].map(async (slug) => {
      const destination = catalog.find((item) => item.slug === slug);
      return {
        slug,
        destination,
        plans: destination ? await getPublishedPlans(destination) : [],
      };
    }),
  );
  const result: ResolvedCart = { items: [], unavailable: [] };
  for (const line of lines) {
    const group = destinations.find((d) => d.slug === line.destination);
    const plan = group?.plans.find(
      (p) => p.id === line.planId && p.kind === "fixed",
    );
    if (!group?.destination || !plan) {
      result.unavailable.push(line);
      continue;
    }
    result.items.push({
      ...line,
      name: group.destination.name,
      countryCode: group.destination.code,
      regional: group.destination.type === "region",
      dataGb: plan.dataGb,
      allowance: plan.allowance,
      days: plan.days,
      network: plan.details?.technologies.join(" / ") ?? "",
    });
  }
  return result;
}
