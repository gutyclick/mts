"use client";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { Header } from "./site-navigation";
import { Footer } from "./footer";
import { MobileNavigation } from "./mobile-navigation";
import { PendingPaymentNotice } from "./commerce/pending-payment-notice";
import { dictionaries, type Locale } from "@/lib/i18n";
import { SupportWidget } from "./support/widget";
export function SiteFrame({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const pathname = usePathname(),
    admin =
      pathname === `/${locale}/admin` ||
      pathname.startsWith(`/${locale}/admin/`);
  return (
    <>
      <a href="#main-content" className="skip-link">
        {dictionaries[locale].skip}
      </a>
      {!admin && (
        <>
          <Header locale={locale} />
          <PendingPaymentNotice locale={locale} />
        </>
      )}
      <main id="main-content">{children}</main>
      {!admin && (
        <>
          <Footer locale={locale} />
          <MobileNavigation locale={locale} />
          <SupportWidget locale={locale} />
        </>
      )}
    </>
  );
}
