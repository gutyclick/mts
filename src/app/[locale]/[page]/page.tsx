import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Check, Info, MapPin, Smartphone } from "lucide-react";
import { DestinationDirectory } from "@/components/destination-directory";
import { FAQ } from "@/components/faq";
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

function pageKey(locale: Locale, page: string) {
  return (Object.keys(routeSegments) as PageKey[]).find(
    (key) => routeSegments[key][locale] === page,
  );
}
function heading(locale: Locale, key: PageKey) {
  const t = dictionaries[locale];
  const content = {
    destinations: [t.destinationsTitle, t.destinationsDescription],
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
    Object.values(routeSegments).map((segments) => ({
      locale,
      page: segments[locale],
    })),
  );
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; page: string }>;
}) {
  const { locale, page } = await params;
  if (!isLocale(locale)) return {};
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
}: {
  params: Promise<{ locale: string; page: string }>;
}) {
  const { locale, page } = await params;
  if (!isLocale(locale)) notFound();
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
          <div className="help-grid">
            {t.helpCards.map((card, index) => (
              <Link
                href={pathFor(locale, index === 0 ? "how" : "compatibility")}
                key={card.title}
              >
                {index === 0 ? <MapPin size={28} /> : <Smartphone size={28} />}
                <h2>{card.title}</h2>
                <p>{card.body}</p>
                <ArrowRight size={20} />
              </Link>
            ))}
          </div>
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
      {(key === "help" || key === "how" || key === "compatibility") && (
        <div className="container">
          <FAQ locale={locale} />
        </div>
      )}
    </>
  );
}
