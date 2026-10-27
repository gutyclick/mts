import { notFound } from "next/navigation";
import { isLocale, locales } from "@/lib/i18n";
import { CartProvider } from "@/components/commerce/cart-provider";
import { SiteFrame } from "@/components/site-frame";
import { StatsProvider } from "@/components/analytics/consent";
import { RegionalPreferences } from "@/components/regional-preferences";
import {CurrencyProvider} from "@/components/currency-provider";
export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}
export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <div lang={locale} className="site-shell">
      <CurrencyProvider><RegionalPreferences locale={locale}>
        <StatsProvider locale={locale}>
          <CartProvider locale={locale}>
            <SiteFrame locale={locale}>{children}</SiteFrame>
          </CartProvider>
        </StatsProvider>
      </RegionalPreferences></CurrencyProvider>
    </div>
  );
}
