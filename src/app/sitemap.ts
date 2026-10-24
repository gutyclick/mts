import type { MetadataRoute } from "next";
import { destinations } from "@/lib/catalog";
import { locales, pathFor, type PageKey } from "@/lib/i18n";
import { siteUrl } from "@/lib/seo";
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: { page?: PageKey; slug?: string }[] = [
    {},
    ...(["destinations", "how", "compatibility", "help"] as PageKey[]).map(
      (page) => ({ page }),
    ),
    ...destinations.map(({ slug }) => ({ slug })),
  ];
  return entries.flatMap(({ page, slug }) =>
    locales.map((locale) => ({
      url: `${siteUrl}${pathFor(locale, page, slug)}`,
      alternates: {
        languages: {
          en: `${siteUrl}${pathFor("en", page, slug)}`,
          es: `${siteUrl}${pathFor("es", page, slug)}`,
          "x-default": `${siteUrl}${pathFor("en", page, slug)}`,
        },
      },
    })),
  );
}
