import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { JsonLd } from "@/components/seo/json-ld";
import { FAQCenter } from "@/components/faq-center";
import { helpTopicIcons } from "@/components/help-topic-icons";
import { helpContent } from "@/lib/help-content";
import { faqTopicSegments, type FAQTopic } from "@/lib/faq-topics";
import {
  faqTopicPath,
  isLocale,
  locales,
  pathFor,
  routeSegments,
} from "@/lib/i18n";
import { localizedMetadata, breadcrumbSchema } from "@/lib/seo";

function resolveTopic(locale: string, page: string, topic: string) {
  if (!isLocale(locale) || page !== routeSegments.faq[locale]) return null;
  const key = (Object.keys(faqTopicSegments) as FAQTopic[]).find(
    (key) => faqTopicSegments[key][locale] === topic,
  );
  const category = helpContent[locale].categories.find(
    (category) => category.id === key,
  );
  return key && category ? { locale, key, category } : null;
}
export function generateStaticParams() {
  return locales.flatMap((locale) =>
    (Object.keys(faqTopicSegments) as FAQTopic[]).map((topic) => ({
      locale,
      page: routeSegments.faq[locale],
      topic: faqTopicSegments[topic][locale],
    })),
  );
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; page: string; topic: string }>;
}) {
  const { locale, page, topic } = await params;
  const resolved = resolveTopic(locale, page, topic);
  if (!resolved) return {};
  const { category, key } = resolved;
  return localizedMetadata(
    resolved.locale,
    `${category.title} · FAQ eSIM`,
    category.description,
    { en: faqTopicPath("en", key), es: faqTopicPath("es", key) },
  );
}
export default async function FAQTopicPage({
  params,
}: {
  params: Promise<{ locale: string; page: string; topic: string }>;
}) {
  const { locale, page, topic } = await params;
  const resolved = resolveTopic(locale, page, topic);
  if (!resolved) notFound();
  const { category, key } = resolved;
  const language = resolved.locale;
  const es = language === "es";
  const Icon = helpTopicIcons[key];
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: es ? "Inicio" : "Home", path: pathFor(language) },
          { name: "FAQ", path: pathFor(language, "faq") },
          { name: category.title, path: faqTopicPath(language, key) },
        ])}
      />
      <header className="container faq-topic-heading">
        <nav
          className="destination-breadcrumb"
          aria-label={es ? "Ruta de navegación" : "Breadcrumb"}
        >
          <ol>
            <li>
              <Link href={pathFor(language)}>
                <Home size={14} aria-hidden="true" />
                {es ? "Inicio" : "Home"}
              </Link>
            </li>
            <li>
              <ChevronRight size={13} aria-hidden="true" />
              <Link href={pathFor(language, "faq")}>FAQ</Link>
            </li>
            <li>
              <ChevronRight size={13} aria-hidden="true" />
              <span aria-current="page">{category.title}</span>
            </li>
          </ol>
        </nav>
        <p className="eyebrow">MYTRIPSIM / FAQ</p>
        <div>
          <span className="learning-icon">
            <Icon size={28} aria-hidden="true" />
          </span>
          <h1>{category.title}</h1>
        </div>
        <p>{category.description}</p>
      </header>
      <FAQCenter key={key} locale={language} topicId={key} />
    </>
  );
}
