import { notFound } from "next/navigation";
import { Hero } from "@/components/home/hero";
import {
  PopularDestinations,
  Steps,
  TrustStrip,
  WhyUs,
} from "@/components/home/sections";
import { FAQ } from "@/components/faq";
import { dictionaries, isLocale } from "@/lib/i18n";
import { metadata, siteUrl } from "@/lib/seo";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = dictionaries[locale];
  return metadata(
    locale,
    locale === "en"
      ? "Stay connected, wherever you go"
      : "Sigue conectado, dondequiera que vayas",
    t.heroDescription,
  );
}
export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "MyTripSim",
            legalName: "YellowCat Enterprises LLC",
            url: siteUrl,
            logo: `${siteUrl}/icon.svg`,
          }).replace(/</g, "\\u003c"),
        }}
      />
      <Hero locale={locale} />
      <TrustStrip locale={locale} />
      <PopularDestinations locale={locale} />
      <Steps locale={locale} />
      <WhyUs locale={locale} />
      <div className="container">
        <FAQ locale={locale} />
      </div>
    </>
  );
}
