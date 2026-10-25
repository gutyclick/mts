import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { authPath } from "@/lib/auth-routes";
import { adminSession } from "@/lib/admin/server";
import { AdminDashboard } from "@/components/admin/dashboard";
export const metadata: Metadata = {
  title: "Administración | MyTripSim",
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
  const session = await adminSession();
  if (!session.user)
    redirect(`${authPath(locale, "login")}?next=/${locale}/admin`);
  if (!session.admin) notFound();
  return <AdminDashboard locale={locale} email={session.user.email ?? ""} />;
}
