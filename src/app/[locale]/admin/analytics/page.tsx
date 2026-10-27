import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { authPath } from "@/lib/auth-routes";
import { adminSession } from "@/lib/admin/server";
import { AnalyticsDashboard } from "@/components/admin/analytics";
export const metadata: Metadata = {
  title: "Ventas · MyTripSim",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const s = await adminSession();
  if (!s.user)
    redirect(`${authPath(locale, "login")}?next=/${locale}/admin/analytics`);
  if (s.needsMfa) redirect(`/${locale}/admin/security`);
  if (!s.admin) notFound();
  return <AnalyticsDashboard locale={locale} />;
}
