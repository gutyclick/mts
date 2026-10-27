import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { adminSession } from "@/lib/admin/server";
import { checkoutDatabase } from "@/lib/payments/checkout-server";
import { simcoinsFlags } from "@/lib/simcoins/config";
import { isLocale } from "@/lib/i18n";
import { authPath } from "@/lib/auth-routes";
import {
  SimcoinsAdmin,
  type SimcoinsAdminView,
} from "@/components/simcoins/admin";
export const metadata: Metadata = {
  title: "SimCoins · Admin",
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
    redirect(`${authPath(locale, "login")}?next=/${locale}/admin/simcoins`);
  if (session.needsMfa) redirect(`/${locale}/admin/security`);
  if (!session.admin) notFound();
  const flags = simcoinsFlags();
  const initial: SimcoinsAdminView = {
    configured: false,
    enabled: false,
    snapshot: null,
  };
  if (flags.adminEnabled && flags.persistenceReady) {
    const result = await checkoutDatabase().rpc("simcoins_admin_snapshot", {
      p_actor: session.user.id,
    });
    if (!result.error && result.data && typeof result.data === "object") {
      initial.configured = true;
      initial.enabled = true;
      initial.snapshot = result.data;
    } else initial.error = "unavailable";
  }
  return <SimcoinsAdmin locale={locale} initialData={initial} />;
}
