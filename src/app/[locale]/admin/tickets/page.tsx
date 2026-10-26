import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { authPath, safeAccountNext } from "@/lib/auth-routes";
import { adminSession } from "@/lib/admin/server";
import { TicketDesk } from "@/components/support/ticket-desk";
export const metadata: Metadata = {
  title: "Tickets · Administración",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ticket?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const query = await searchParams,
    session = await adminSession();
  if (!session.user)
    redirect(
      `${authPath(locale, "login")}?next=${encodeURIComponent(safeAccountNext(`/${locale}/admin/tickets${query.ticket ? `?ticket=${query.ticket}` : ""}`, locale))}`,
    );
  if (session.needsMfa) redirect(`/${locale}/admin/security`);
  if (!session.admin) notFound();
  return <TicketDesk locale={locale} staff />;
}
