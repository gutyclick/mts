import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { destinations } from "./catalog";
import { getPlans as getLocalPlans } from "./plans";
import { catalogConfig, createCatalogAPI } from "./supabase/catalog-api";
import type { Destination } from "./catalog";

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
