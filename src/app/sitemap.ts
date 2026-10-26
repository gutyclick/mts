import type { MetadataRoute } from "next";
import { getDestinations } from "@/lib/catalog-server";
import { locales, pathFor, faqTopicPath, type PageKey } from "@/lib/i18n";
import { faqTopicSegments, type FAQTopic } from "@/lib/faq-topics";
import { experiencePath } from "@/lib/experience-routes";
import { siteUrl } from "@/lib/seo";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const destinations = await getDestinations();
  const entries: { page?: PageKey; slug?: string }[] = [
    {},
    ...(["destinations", "how", "compatibility", "faq"] as PageKey[]).map(
      (page) => ({ page }),
    ),
    ...destinations.map(({ slug }) => ({ slug })),
  ];
  return [
    ...locales.map((locale) => ({
      url: `${siteUrl}${experiencePath(locale, "install")}`,
      alternates: {
        languages: {
          en: `${siteUrl}${experiencePath("en", "install")}`,
          es: `${siteUrl}${experiencePath("es", "install")}`,
          "x-default": `${siteUrl}${experiencePath("en", "install")}`,
        },
      },
    })),
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
