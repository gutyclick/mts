import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { adminSession } from "@/lib/admin/server";
import { isLocale } from "@/lib/i18n";
import { authPath } from "@/lib/auth-routes";
import { CompaniesAdmin } from "@/components/admin/companies";
import "@/styles/business-admin.css";
export const metadata: Metadata = {
  title: "Empresas · MyTripSim Business",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await adminSession();
  if (!session.user)
    redirect(`${authPath(locale, "login")}?next=/${locale}/admin/companies`);
  if (session.needsMfa) redirect(`/${locale}/admin/security`);
  if (!session.admin) notFound();
  return <CompaniesAdmin locale={locale} />;
}
