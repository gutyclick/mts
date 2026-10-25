import rawDestinations from "../data/destinations.json" with { type: "json" };
import banners from "../data/destination-images.json" with { type: "json" };
import { normalize } from "./text.ts";
import type { Locale } from "./i18n";

export interface Destination {
  slug: string;
  name: Record<Locale, string>;
  code: string;
  type: "country" | "region";
  aliases: string[];
  planCount: number;
  dataMinGb: number;
  dataMaxGb: number;
  image: string;
  artworkKind: "banner" | "illustration" | "flag";
}
const illustrations: Record<string, string> = {
  japan: "/illustrations/japan.svg",
  "united-states": "/illustrations/united-states.svg",
  europe: "/illustrations/europe.svg",
  thailand: "/illustrations/thailand.svg",
  "united-kingdom": "/illustrations/united-kingdom.svg",
  australia: "/illustrations/australia.svg",
};
const images = banners as Record<string, string>;
export const destinations: Destination[] = rawDestinations.map(
  (destination) => ({
    ...destination,
    type: destination.type as Destination["type"],
    image:
      images[destination.slug] ??
      illustrations[destination.slug] ??
      (destination.type === "country"
        ? `/flags/${destination.code.toLowerCase()}.svg`
        : "/illustrations/world.svg"),
    artworkKind: images[destination.slug]
      ? "banner"
      : illustrations[destination.slug] || destination.type === "region"
        ? "illustration"
        : "flag",
  }),
);
export const popularDestinations = [
  "japan",
  "united-states",
  "france",
  "italy",
  "europe",
  "thailand",
].map((slug) => destinations.find((destination) => destination.slug === slug)!);
export { normalize };
export function searchDestinations(
  query: string,
  items = destinations,
): Destination[] {
  const value = normalize(query);
  if (!value) return items;
  const candidates = items.map((destination) => ({
    destination,
    names: [
      destination.name.en,
      destination.name.es,
      destination.code,
      destination.slug,
      ...destination.aliases,
    ].map(normalize),
  }));
  const exact = candidates.filter(({ names }) => names.includes(value));
  if (exact.length) return exact.map(({ destination }) => destination);
  return candidates
    .filter(({ names }) =>
      names.some((name) =>
        value.length <= 2 ? name.startsWith(value) : name.includes(value),
      ),
    )
    .map(({ destination }) => destination);
}
