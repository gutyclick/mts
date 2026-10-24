import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Globe2, Smartphone } from "lucide-react";
import { FAQ } from "@/components/faq";
import { PlanBrowser } from "@/components/plan-browser";
import { DestinationArtwork } from "@/components/illustrations";
import { destinations } from "@/lib/catalog";
import { dictionaries, isLocale, locales, pathFor } from "@/lib/i18n";
import { metadata } from "@/lib/seo";
export function generateStaticParams() {
  return locales.flatMap((locale) =>
    destinations.map(({ slug }) => ({ locale, slug })),
  );
}
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const destination = destinations.find((item) => item.slug === slug);
  if (!isLocale(locale) || !destination) return {};
  return metadata(
    locale,
    `${destination.name[locale]} eSIM`,
    destination.intro[locale],
    undefined,
    slug,
  );
}
export default async function DestinationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ days?: string }>;
}) {
  const { locale, slug } = await params;
  const destination = destinations.find((item) => item.slug === slug);
  if (!isLocale(locale) || !destination) notFound();
  const t = dictionaries[locale];
  const { days } = await searchParams;
  return (
    <div className="container destination-page">
      <Link href={pathFor(locale, "destinations")} className="back-link">
        <ArrowLeft size={16} />
        {t.back}
      </Link>
      <section className="destination-banner">
        <div>
          <p className="eyebrow">
            <Globe2 size={15} />
            {destination.type === "region" ? t.region : t.country}
          </p>
          <h1>
            {destination.name[locale]}
            <span> eSIM</span>
          </h1>
          <p>{destination.intro[locale]}</p>
        </div>
        <div className="banner-photo">
          <DestinationArtwork
            destination={destination}
            locale={locale}
            sizes="(max-width: 650px) 90vw, 34vw"
            eager
          />
        </div>
      </section>
      <PlanBrowser
        locale={locale}
        destination={destination}
        initialDays={days}
      />
      <section className="compatibility-reminder">
        <Smartphone size={28} />
        <div>
          <h2>{t.compatibleReminder}</h2>
          <p>{t.compatibleBody}</p>
        </div>
        <Link href={pathFor(locale, "compatibility")}>
          {t.checkCompatibility}
          <ArrowRight size={17} />
        </Link>
      </section>
      <section className="coverage-section">
        <h2>{t.coverage}</h2>
        <p>{destination.coverage[locale]}</p>
        <p>{t.coverageSample}</p>
      </section>
      <FAQ locale={locale} title={t.planFaq} compact />
    </div>
  );
}
