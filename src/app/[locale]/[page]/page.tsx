import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Info } from "lucide-react";
import { DestinationDirectory } from "@/components/destination-directory";
import { FAQCenter } from "@/components/faq-center";
import { HelpHub } from "@/components/help-hub";
import { helpContent } from "@/lib/help-content";
import { catalogCopy } from "@/lib/catalog-copy";
import { Steps } from "@/components/home/sections";
import {
  dictionaries,
  isLocale,
  locales,
  pathFor,
  routeSegments,
  type Locale,
  type PageKey,
} from "@/lib/i18n";
import { metadata } from "@/lib/seo";
import {
  experienceKey,
  experiencePath,
  experienceSegments,
} from "@/lib/experience-routes";
import { experienceCopy } from "@/lib/experience-copy";
import {
  ExperiencePage,
  type ExperienceQuery,
} from "@/components/experience/experience-page";

function pageKey(locale: Locale, page: string) {
  return (Object.keys(routeSegments) as PageKey[]).find(
    (key) => routeSegments[key][locale] === page,
  );
}
function heading(locale: Locale, key: PageKey) {
  const t = dictionaries[locale];
  const content = {
    destinations: [catalogCopy[locale].title, catalogCopy[locale].description],
    faq: [helpContent[locale].title, helpContent[locale].description],
    how: [t.howTitle, t.howDescription],
    compatibility: [t.compatibilityTitle, t.compatibilityDescription],
    help: [t.helpTitle, t.helpDescription],
    terms: [t.nav.terms, t.legalIntro],
    privacy: [t.nav.privacy, t.legalIntro],
    refunds: [t.nav.refunds, t.legalIntro],
  };
  return content[key];
}
export function generateStaticParams() {
  return locales.flatMap((locale) =>
    [...Object.values(routeSegments), ...Object.values(experienceSegments)].map(
      (segments) => ({
        locale,
        page: segments[locale],
      }),
    ),
  );
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; page: string }>;
}) {
  const { locale, page } = await params;
  if (!isLocale(locale)) return {};
  const experience = experienceKey(locale, page);
  if (experience)
    return {
      title: experienceCopy[locale][experience],
      robots: { index: false, follow: false },
      alternates: {
        canonical: experiencePath(locale, experience),
        languages: {
          en: experiencePath("en", experience),
          es: experiencePath("es", experience),
        },
      },
    };
  const key = pageKey(locale, page);
  if (!key) return {};
  const [title, description] = heading(locale, key);
  return {
    ...metadata(locale, title, description, key),
    ...(key === "terms" || key === "privacy" || key === "refunds"
      ? { robots: { index: false, follow: true } }
      : {}),
  };
}
export default async function ContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; page: string }>;
  searchParams: Promise<ExperienceQuery>;
}) {
  const { locale, page } = await params;
  if (!isLocale(locale)) notFound();
  const experience = experienceKey(locale, page);
  if (experience)
    return (
      <ExperiencePage
        locale={locale}
        page={experience}
        query={await searchParams}
      />
    );
  const key = pageKey(locale, page);
  if (!key) notFound();
  const t = dictionaries[locale];
  const [title, description] = heading(locale, key);
  return (
    <>
      <section className="page-heading container">
        <p className="eyebrow">MYTRIPSIM / {t.nav[key]}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
      {key === "destinations" && (
        <section className="container directory-section">
          <DestinationDirectory locale={locale} />
          <p className="preview-note">{t.previewNotice}</p>
        </section>
      )}
      {key === "how" && (
        <>
          <Steps locale={locale} standalone />
          <section className="container guide-section">
            <h2>{t.howChecklist}</h2>
            <ul className="checklist">
              {t.howItems.map((item) => (
                <li key={item}>
                  <Check size={20} />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={pathFor(locale, "destinations")}
              className="button button-primary"
            >
              {t.find}
              <ArrowRight size={17} />
            </Link>
          </section>
        </>
      )}
      {key === "compatibility" && (
        <section className="container guide-section">
          <div className="guide-grid">
            {t.compatibilitySteps.map((step, index) => (
              <article key={step.title}>
                <span className="guide-number">0{index + 1}</span>
                <h2>{step.title}</h2>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
          <p className="information-note">
            <Info size={21} />
            {t.compatibilityNote}
          </p>
        </section>
      )}
      {key === "help" && (
        <section className="container guide-section">
          <HelpHub locale={locale} />
          <p className="information-note">
            <Info size={21} />
            {t.helpNote}
          </p>
        </section>
      )}
      {(key === "terms" || key === "privacy" || key === "refunds") && (
        <section className="container legal-section">
          <p className="information-note">
            <Info size={21} />
            {t.legalDraft}
          </p>
          <p>{t.legalContent[key]}</p>
        </section>
      )}
      {key === "faq" && <FAQCenter locale={locale} />}
      {(key === "how" || key === "compatibility") && (
        <div className="container guide-support-link">
          <Link
            className="button button-secondary"
            href={pathFor(locale, "faq")}
          >
            {catalogCopy[locale].faq}
            <ArrowRight size={18} />
          </Link>
        </div>
      )}
    </>
  );
}
