import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { authPath, safeAccountNext } from "@/lib/auth-routes";
import { supportUser, SupportError } from "@/lib/support/server";
import { TicketDesk } from "@/components/support/ticket-desk";
export const metadata: Metadata = {
  title: "Ayuda · Tickets",
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
  const query = await searchParams;
  try {
    await supportUser();
  } catch (e) {
    if (e instanceof SupportError && e.code === "auth_required")
      redirect(
        `${authPath(locale, "login")}?next=${encodeURIComponent(safeAccountNext(`/${locale}/support${query.ticket ? `?ticket=${query.ticket}` : ""}`, locale))}`,
      );
    throw e;
  }
  return <TicketDesk locale={locale} />;
}
