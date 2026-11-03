import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { destinations } from "./catalog";
import { getPlans as getLocalPlans } from "./plans";
import { catalogConfig, createCatalogAPI } from "./supabase/catalog-api";
import type { Destination } from "./catalog";
import { curateCatalog, isCommerciallyAllowed } from "./catalog-curation";
import connectivityEvidence from "../data/catalog-connectivity-evidence.json";

async function api() {
  const config = catalogConfig(process.env);
  if (!config) return null;
  // Connected catalogs render at request time, including routes with static params.
  await connection();
  return createCatalogAPI(config);
}
export const getDestinations = cache(async (): Promise<Destination[]> => {
  const client = await api();
  return client ? client.destinations() : destinations;
});
export const getDestination = cache(async (slug: string) =>
  (await getDestinations()).find((d) => d.slug === slug),
);
export const getPublishedPlans = cache(async (destination: Destination) => {
  const client = await api();
  return client ? client.plans(destination.slug) : getLocalPlans(destination);
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
  ].flatMap((slug) => items.filter((d) => d.slug === slug));
}
