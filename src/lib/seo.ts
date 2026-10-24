import type { Metadata } from "next";
import { pathFor, type Locale, type PageKey } from "./i18n";
export const siteUrl = "https://mytripsim.com";
export function metadata(
  locale: Locale,
  title: string,
  description: string,
  page?: PageKey,
  slug?: string,
): Metadata {
  const path = pathFor(locale, page, slug);
  return {
    title,
    description,
    alternates: {
      canonical: path,
      languages: {
        en: pathFor("en", page, slug),
        es: pathFor("es", page, slug),
        "x-default": pathFor("en", page, slug),
      },
    },
    openGraph: {
      title: `${title} | MyTripSim`,
      description,
      url: path,
      locale: locale === "es" ? "es_PA" : "en_US",
      alternateLocale: locale === "es" ? "en_US" : "es_PA",
      siteName: "MyTripSim",
      type: "website",
      images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
  };
}
