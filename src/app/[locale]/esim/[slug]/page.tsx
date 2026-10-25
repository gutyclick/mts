import { notFound } from "next/navigation";
import { destinationContent } from "@/lib/destination-content";
import { getDestination, getPublishedPlans } from "@/lib/catalog-server";
import { destinations } from "@/lib/catalog";
import { isLocale, locales } from "@/lib/i18n";
import { metadata } from "@/lib/seo";
import { DestinationPlanPage } from "@/components/experience/destination-plan-page";
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
  const destination = await getDestination(slug);
  if (!isLocale(locale) || !destination) return {};
  return metadata(
    locale,
    `${destination.name[locale]} eSIM`,
    destinationContent(
      locale,
      destination,
      await getPublishedPlans(destination),
    ).description,
    undefined,
    slug,
  );
}
export default async function DestinationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ days?: string; plan?: string }>;
}) {
  const { locale, slug } = await params;
  const destination = await getDestination(slug);
  if (!isLocale(locale) || !destination) notFound();
  const { days, plan } = await searchParams;
  return (
    <DestinationPlanPage
      locale={locale}
      destination={destination}
      initialDays={days}
      initialPlanId={plan}
    />
  );
}
