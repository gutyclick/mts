import { notFound, permanentRedirect } from "next/navigation";
import { getDestination, getPublishedPlans } from "@/lib/catalog-server";
import { isLocale, pathFor } from "@/lib/i18n";
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string; slug: string; planId: string }>;
}) {
  const { locale, slug, planId } = await params;
  if (!isLocale(locale)) notFound();
  const destination = await getDestination(slug);
  if (!destination) notFound();
  const plan = (await getPublishedPlans(destination)).find(
    (p) => p.id === planId,
  );
  if (!plan) notFound();
  permanentRedirect(
    pathFor(locale, undefined, slug) + "?plan=" + encodeURIComponent(plan.id),
  );
}
