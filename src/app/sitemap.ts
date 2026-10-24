import type { MetadataRoute } from "next";
import { destinations } from "@/lib/catalog";
import { locales, pathFor, faqTopicPath, type PageKey } from "@/lib/i18n";
import { faqTopicSegments, type FAQTopic } from "@/lib/faq-topics";
import { siteUrl } from "@/lib/seo";
export default function sitemap(): MetadataRoute.Sitemap {
  const entries: { page?: PageKey; slug?: string }[] = [
    {},
    ...(
      ["destinations", "how", "compatibility", "help", "faq"] as PageKey[]
    ).map((page) => ({ page })),
    ...destinations.map(({ slug }) => ({ slug })),
  ];
  return [
    ...entries.flatMap(({ page, slug }) =>
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
    ),
    ...(Object.keys(faqTopicSegments) as FAQTopic[]).flatMap((topic) =>
      locales.map((locale) => ({
        url: `${siteUrl}${faqTopicPath(locale, topic)}`,
        alternates: {
          languages: {
            en: `${siteUrl}${faqTopicPath("en", topic)}`,
            es: `${siteUrl}${faqTopicPath("es", topic)}`,
            "x-default": `${siteUrl}${faqTopicPath("en", topic)}`,
          },
        },
      })),
    ),
  ];
}
