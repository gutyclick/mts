import { notFound } from "next/navigation";
import { Hero } from "@/components/home/hero";
import { PopularDestinations, TrustStrip } from "@/components/home/sections";
import { LearningLinks } from "@/components/learning-links";
import { isLocale } from "@/lib/i18n";
import { metadata, siteIdentity } from "@/lib/seo";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return metadata(
    locale,
    locale === "en"
      ? "Travel eSIM: data plans for your next destination"
      : "eSIM de viaje: planes de datos para tu destino",
    locale === "es"
      ? "Compara planes eSIM de datos para países y regiones. Elige tus GB y días, consulta la cobertura y verifica si tu móvil es compatible con MyTripSim."
      : "Compare travel eSIM data plans for countries and regions. Choose data and days, review coverage and check device compatibility with MyTripSim.",
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
          __html: JSON.stringify(siteIdentity).replace(/</g, "\\u003c"),
        }}
      />
      <Hero locale={locale} />
      <TrustStrip locale={locale} />
      <PopularDestinations locale={locale} />
      <LearningLinks locale={locale} />
    </>
  );
}
