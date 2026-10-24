import { notFound } from "next/navigation";
import { destinations } from "@/lib/catalog";
import { isLocale } from "@/lib/i18n";
import { getPlans } from "@/lib/plans";
import { planPath } from "@/lib/experience-routes";
import { PlanDetail } from "@/components/experience/plan-detail";
type Props = {
  params: Promise<{ locale: string; slug: string; planId: string }>;
};
export async function generateMetadata({ params }: Props) {
  const { locale, slug, planId } = await params;
  const destination = destinations.find((d) => d.slug === slug);
  if (!isLocale(locale) || !destination) return {};
  const plan = getPlans(destination).find((p) => p.id === planId);
  if (!plan) return {};
  return {
    title: plan.name,
    description: `${destination.name[locale]} · ${plan.allowance} · ${plan.days} ${locale === "es" ? "días" : "days"}`,
    alternates: {
      canonical: planPath(locale, slug, planId),
      languages: {
        en: planPath("en", slug, planId),
        es: planPath("es", slug, planId),
      },
    },
  };
}
export default async function Page({ params }: Props) {
  const { locale, slug, planId } = await params;
  const destination = destinations.find((d) => d.slug === slug);
  if (!isLocale(locale) || !destination) notFound();
  const plan = getPlans(destination).find((p) => p.id === planId);
  if (!plan) notFound();
  return <PlanDetail locale={locale} destination={destination} plan={plan} />;
}
