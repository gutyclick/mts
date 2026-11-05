import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { adminSession } from "@/lib/admin/server";
import { isLocale } from "@/lib/i18n";
import { authPath } from "@/lib/auth-routes";
import { BusinessCommerceAdmin } from "@/components/admin/business-commerce";
import "@/styles/business-commerce.css";

export const metadata: Metadata = {
  title: "B2B Commerce · Admin",
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
    redirect(
      `${authPath(locale, "login")}?next=/${locale}/admin/business-commerce`,
    );
  if (session.needsMfa) redirect(`/${locale}/admin/security`);
  if (!session.admin) notFound();
  return <BusinessCommerceAdmin locale={locale} />;
}
