import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import { DestinationDirectory } from "@/components/destination-directory";
import { CompatibilityChecker } from "@/components/compatibility-checker";
import { FAQCenter } from "@/components/faq-center";
import { HelpHub } from "@/components/help-hub";
import { helpContent } from "@/lib/help-content";
import { catalogCopy } from "@/lib/catalog-copy";
import { HowItWorksPage } from "@/components/how-it-works-page";
import { SimMascot } from "@/components/sim-mascot";
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
import { getDestinations } from "@/lib/catalog-server";
import { authMode, authSegments, authPath } from "@/lib/auth-routes";
import { AuthPage } from "@/components/account/auth-page";
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
    [
      ...Object.values(routeSegments),
      ...Object.values(experienceSegments),
      ...Object.values(authSegments),
    ].map((segments) => ({
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
  const accountMode = authMode(locale, page);
  if (accountMode)
    return {
      title: locale === "es" ? "Tu cuenta" : "Your account",
      robots: { index: false, follow: false },
      alternates: {
        canonical: authPath(locale, accountMode),
        languages: {
          en: authPath("en", accountMode),
          es: authPath("es", accountMode),
        },
      },
    };
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
  const accountMode = authMode(locale, page);
  if (accountMode) {
    const query = await searchParams;
    return (
      <AuthPage
        locale={locale}
        mode={accountMode}
        next={query.next}
        error={typeof query.error === "string" ? query.error : undefined}
      />
    );
  }
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
  if (key === "how") return <HowItWorksPage locale={locale} />;
  const t = dictionaries[locale];
  const [title, description] = heading(locale, key);
  return (
    <>
      {key === "faq" ? (
        <header className="container sim-faq-heading">
          <div className="sim-faq-copy">
            <p className="eyebrow">MYTRIPSIM / {t.nav.faq}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <SimMascot
            variant="help"
            locale={locale}
            className="faq-sim-mascot"
            sizes="(max-width: 650px) 136px, (max-width: 900px) 220px, 280px"
            eager
          />
        </header>
      ) : (
        <section className="page-heading container">
          <p className="eyebrow">MYTRIPSIM / {t.nav[key]}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </section>
      )}
      {key === "destinations" && (
        <section className="container directory-section">
          <DestinationDirectory
            locale={locale}
            items={await getDestinations()}
          />
          <p className="preview-note">{t.previewNotice}</p>
        </section>
      )}
      {key === "compatibility" && (
        <section className="container guide-section">
          <div className="compat-guide-launch">
            <CompatibilityChecker locale={locale} />
          </div>
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
      {key === "compatibility" && (
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
