import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { authPath } from "@/lib/auth-routes";
import { authClient } from "@/lib/supabase/auth-server";
import { adminSession } from "@/lib/admin/server";
import { AdminSecurity } from "@/components/admin/security";
export const metadata: Metadata = {
  title: "Acceso seguro · MyTripSim",
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
    redirect(`${authPath(locale, "login")}?next=/${locale}/admin/security`);
  if (!session.member) notFound();
  if (session.admin) redirect(`/${locale}/admin`);
  const { data, error } = await (await authClient()).auth.mfa.listFactors();
  if (error) throw Error("Security unavailable");
  return (
    <AdminSecurity
      locale={locale}
      factorId={data.totp.find((f) => f.status === "verified")?.id ?? null}
    />
  );
}
