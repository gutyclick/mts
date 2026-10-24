import type { Locale } from "./i18n";

export interface Destination {
  slug: string;
  name: Record<Locale, string>;
  intro: Record<Locale, string>;
  aliases: string[];
  image: string;
  illustration?: string;
  code: string;
  type: "country" | "region";
  startingPrice: number;
  coverage: Record<Locale, string>;
}
export interface Plan {
  id: string;
  destinationSlug: string;
  dataGb: number;
  days: number;
  priceUsd: number;
  source: "mock";
  network: null;
  activation: null;
  topUp: null;
}
export const destinations: Destination[] = [
  {
    slug: "japan",
    name: { en: "Japan", es: "Japón" },
    intro: {
      en: "From Tokyo side streets to Kyoto's quiet gardens. Take your connection along.",
      es: "De las calles de Tokio a los jardines de Kioto. Lleva tu conexión contigo.",
    },
    aliases: ["japon", "nippon", "tokyo", "tokio", "kyoto"],
    image: "/images/japan.jpg",
    illustration: "/illustrations/japan.svg",
    code: "JP",
    type: "country",
    startingPrice: 4.5,
    coverage: { en: "Japan", es: "Japón" },
  },
  {
    slug: "united-states",
    name: { en: "United States", es: "Estados Unidos" },
    intro: {
      en: "City lights, open roads, and everything in between. Stay in touch on your American adventure.",
      es: "Ciudades, carreteras y todo lo que hay entre ellas. Conéctate en tu aventura por Estados Unidos.",
    },
    aliases: [
      "usa",
      "us",
      "eeuu",
      "ee. uu.",
      "america",
      "new york",
      "nueva york",
    ],
    image: "/images/united-states.jpg",
    illustration: "/illustrations/united-states.svg",
    code: "US",
    type: "country",
    startingPrice: 4,
    coverage: { en: "United States", es: "Estados Unidos" },
  },
  {
    slug: "europe",
    name: { en: "Europe", es: "Europa" },
    intro: {
      en: "One journey, so many possibilities. Explore a regional data plan for your European itinerary.",
      es: "Un viaje, muchas posibilidades. Explora un plan regional para tu itinerario europeo.",
    },
    aliases: [
      "eu",
      "europa",
      "france",
      "francia",
      "paris",
      "spain",
      "espana",
      "italy",
      "italia",
    ],
    image: "/images/europe.jpg",
    illustration: "/illustrations/europe.svg",
    code: "EU",
    type: "region",
    startingPrice: 5,
    coverage: {
      en: "Illustrative European region; included countries are not yet confirmed.",
      es: "Región europea ilustrativa; los países incluidos aún no están confirmados.",
    },
  },
  {
    slug: "thailand",
    name: { en: "Thailand", es: "Tailandia" },
    intro: {
      en: "Golden temples, night markets, and island days. Keep your next discovery within reach.",
      es: "Templos dorados, mercados nocturnos y días de playa. Tu próxima aventura, más cerca.",
    },
    aliases: ["thai", "tailandia", "bangkok", "phuket"],
    image: "/images/thailand.jpg",
    illustration: "/illustrations/thailand.svg",
    code: "TH",
    type: "country",
    startingPrice: 3.5,
    coverage: { en: "Thailand", es: "Tailandia" },
  },
  {
    slug: "united-kingdom",
    name: { en: "United Kingdom", es: "Reino Unido" },
    intro: {
      en: "London mornings and countryside escapes. Find a data plan for the journey ahead.",
      es: "Mañanas en Londres y escapadas al campo. Encuentra un plan para el camino que te espera.",
    },
    aliases: [
      "uk",
      "gb",
      "great britain",
      "england",
      "inglaterra",
      "gran bretana",
      "london",
      "londres",
      "scotland",
      "escocia",
    ],
    image: "/images/united-kingdom.jpg",
    illustration: "/illustrations/united-kingdom.svg",
    code: "GB",
    type: "country",
    startingPrice: 4.5,
    coverage: { en: "United Kingdom", es: "Reino Unido" },
  },
  {
    slug: "australia",
    name: { en: "Australia", es: "Australia" },
    intro: {
      en: "Coastal walks, city cafés, and wide-open horizons. Make room for a little more exploring.",
      es: "Paseos por la costa, cafés y horizontes abiertos. Haz espacio para explorar un poco más.",
    },
    aliases: ["au", "sydney", "sidney", "melbourne"],
    image: "/images/australia.jpg",
    illustration: "/illustrations/australia.svg",
    code: "AU",
    type: "country",
    startingPrice: 5,
    coverage: { en: "Australia", es: "Australia" },
  },
];
export const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
export function searchDestinations(query: string): Destination[] {
  const normalized = normalize(query);
  if (!normalized) return destinations;
  return destinations.filter((destination) =>
    [
      destination.name.en,
      destination.name.es,
      destination.slug,
      destination.code,
      ...destination.aliases,
    ].some((name) =>
      normalized.length <= 2
        ? normalize(name) === normalized ||
          normalize(name).startsWith(normalized)
        : normalize(name).includes(normalized),
    ),
  );
}
export function getPlans(destination: Destination): Plan[] {
  return [
    { dataGb: 1, days: 7, factor: 1 },
    { dataGb: 3, days: 15, factor: 2.4 },
    { dataGb: 5, days: 30, factor: 3.6 },
    { dataGb: 10, days: 30, factor: 6 },
  ].map(({ dataGb, days, factor }) => ({
    id: `${destination.slug}-${dataGb}gb-${days}d`,
    destinationSlug: destination.slug,
    dataGb,
    days,
    priceUsd: Math.round(destination.startingPrice * factor * 100) / 100,
    source: "mock",
    network: null,
    activation: null,
    topUp: null,
  }));
}
export function filterPlans(plans: Plan[], data: string, days: string): Plan[] {
  return plans.filter(
    (plan) =>
      (!data || plan.dataGb === Number(data)) &&
      (!days || plan.days === Number(days)),
  );
}
export const money = (value: number, locale: Locale) =>
  new Intl.NumberFormat(locale === "es" ? "es-PA" : "en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
