import type { Metadata } from "next";
import { pathFor, type Locale, type PageKey } from "./i18n.ts";
export const siteUrl = "https://www.mytripsim.com";
export function metadata(
  locale: Locale,
  title: string,
  description: string,
  page?: PageKey,
  slug?: string,
): Metadata {
  return localizedMetadata(locale, title, description, {
    en: pathFor("en", page, slug),
    es: pathFor("es", page, slug),
  });
}
export function localizedMetadata(
  locale: Locale,
  title: string,
  description: string,
  paths: Record<Locale, string>,
): Metadata {
  const path = absoluteUrl(paths[locale]);
  return {
    title,
    description,
    alternates: {
      canonical: path,
      languages: {
        en: absoluteUrl(paths.en),
        es: absoluteUrl(paths.es),
        "x-default": absoluteUrl(paths.en),
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

export function absoluteUrl(path: string) {
  return new URL(path, siteUrl).href;
}
export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}
export const siteIdentity = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": siteUrl + "/#organization",
      name: "MyTripSim",
      legalName: "YellowCat Enterprises LLC",
      url: siteUrl,
      logo: siteUrl + "/icons/icon-512.png",
      email: "hello@mytripsim.com",
      contactPoint: {
        "@type": "ContactPoint",
        contactType: "customer support",
        email: "hello@mytripsim.com",
        availableLanguage: ["Spanish", "English"],
      },
    },
    {
      "@type": "WebSite",
      "@id": siteUrl + "/#website",
      url: siteUrl,
      name: "MyTripSim",
      publisher: { "@id": siteUrl + "/#organization" },
      inLanguage: ["es", "en"],
    },
  ],
};
