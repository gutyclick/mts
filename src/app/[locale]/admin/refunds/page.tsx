import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { adminSession } from "@/lib/admin/server";
import { isLocale } from "@/lib/i18n";
import { authPath } from "@/lib/auth-routes";
import { RefundsDashboard } from "@/components/admin/refunds";
import { adminRefundView } from "@/lib/payments/refund-server";
export const metadata: Metadata = {
  title: "Reembolsos · MyTripSim",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const s = await adminSession();
  if (!s.user)
    redirect(`${authPath(locale, "login")}?next=/${locale}/admin/refunds`);
  if (s.needsMfa) redirect(`/${locale}/admin/security`);
  if (!s.admin) notFound();
  const { order } = await searchParams;
  const initialOrder = z.uuid().safeParse(order).success ? order! : null;
  const initialData = await adminRefundView(s.user.id, initialOrder);
  return (
    <RefundsDashboard
      locale={locale}
      initialOrder={initialOrder}
      initialData={initialData}
    />
  );
}
