import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { destinations } from "./catalog";
import { getPlans as getLocalPlans } from "./plans";
import { catalogConfig, createCatalogAPI } from "./supabase/catalog-api";
import type { Destination } from "./catalog";
import {
  curateCatalog,
  isCommerciallyAllowed,
  connectivityMode,
} from "./catalog-curation";
import { catalogPreviewEnabled } from "./catalog-preview";
import connectivityEvidence from "../data/catalog-connectivity-evidence.json";
import { applyRegionalPolicy } from "./regional-catalog-policy";
import regionalPolicy from "../data/regional-catalog-policy.json";
import { applyPreviewPrices } from "./catalog-preview-prices";

async function api() {
  const config = catalogConfig(process.env);
  if (!config) return null;
  // Connected catalogs render at request time, including routes with static params.
  await connection();
  return createCatalogAPI(config);
}
const getRawDestinations = cache(async (): Promise<Destination[]> => {
  const client = await api();
  return client ? client.destinations() : destinations;
});
export const getDestinations = cache(async (): Promise<Destination[]> => {
  const all = await getRawDestinations();
  return applyRegionalPolicy(all);
});
export const getDestination = cache(
  async (slug: string) =>
    // Existing URLs retain their original coverage and SKU family, even when hidden in discovery.
    (await getDestinations()).find((d) => d.slug === slug) ??
    (await getRawDestinations()).find((d) => d.slug === slug),
);
export const getPublishedPlans = cache(async (destination: Destination) => {
  const client = await api();
  const plans = client
    ? await client.plans(destination.slug)
    : getLocalPlans(destination);
  return applyPreviewPrices(plans, process.env);
});
const getMerchandising = cache(async () => {
  const client = await api();
  return client ? client.merchandising() : null;
});
export const getCuratedCatalog = cache(async (destination: Destination) => {
  const [plans, config] = await Promise.all([
    getPublishedPlans(destination),
    getMerchandising(),
  ]);
  const available = config ? new Set(config.availableIds) : null;
  const destinationConfig = config?.destinations.find(
    (d) => d.destination_slug === destination.slug,
  );
  return curateCatalog({
    plans: available ? plans.filter((p) => available.has(p.id)) : plans,
    destinationCode: destination.code,
    destinationType: destination.type,
    overrides: config?.overrides,
    approvedModes: destinationConfig?.approval_verified
      ? destinationConfig.approved_modalities
      : undefined,
    evidence: connectivityEvidence,
  });
});
export async function getCommercialPlans(destination: Destination) {
  const [plans, config] = await Promise.all([
    getPublishedPlans(destination),
    getMerchandising(),
  ]);
  return plans.filter(
    (p) =>
      isCommerciallyAllowed(p.id, config?.overrides ?? []) &&
      (!config || config.availableIds.includes(p.id)),
  );
}
export async function getPopularDestinations() {
  const items = await getDestinations();
  return [
    "japan",
    "united-states",
    "france",
    "italy",
    "europe",
    "thailand",
  ].flatMap((slug) => {
    const source =
      regionalPolicy.groups.find((g) => g.canonicalSlugs.includes(slug))
        ?.sourceSlug ?? slug;
    return items.filter((d) => d.slug === source);
  });
}

/** Full exact SKU matrix for local review; no approval/publication state is written. */
export const getPreviewPlanOptions = cache(async (destination: Destination) => {
  const [plans, config] = await Promise.all([
    getPublishedPlans(destination),
    getMerchandising(),
  ]);
  return plans.filter(
    (p) =>
      isCommerciallyAllowed(p.id, config?.overrides ?? []) &&
      (!config || config.availableIds.includes(p.id)) &&
      p.kind === "fixed" &&
      p.coverageCode === destination.code &&
      p.details?.dataGb === p.dataGb &&
      p.details.days === p.days &&
      Number.isSafeInteger(p.retailPriceCents) &&
      p.retailPriceCents! > 0 &&
      (destination.type === "region" ||
        p.details.coverage.includes(destination.code)) &&
      p.details.networks.some(
        (n) =>
          n.operators.length > 0 &&
          (destination.type === "region" || n.countryCode === destination.code),
      ),
  );
});

/** All real standard GB/day combinations; variants retain existing commercial approvals. */
export const getPlanOptions = cache(async (destination: Destination) => {
  const options = await getPreviewPlanOptions(destination);
  if (catalogPreviewEnabled(process.env)) return options;
  const curated = await getCuratedCatalog(destination);
  const approvedVariantIds = new Set(
    curated.modes.flatMap((mode) => [
      ...mode.plans.map((item) => item.plan.id),
      ...mode.secondaryPlans.map((p) => p.id),
    ]),
  );
  return options.filter(
    (p) => connectivityMode(p) === "standard" || approvedVariantIds.has(p.id),
  );
});
