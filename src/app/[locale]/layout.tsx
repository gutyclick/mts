import { notFound } from "next/navigation";
import { Header } from "@/components/site-navigation";
import { Footer } from "@/components/footer";
import { MobileNavigation } from "@/components/mobile-navigation";
import { dictionaries, isLocale, locales } from "@/lib/i18n";
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
      <a href="#main-content" className="skip-link">
        {dictionaries[locale].skip}
      </a>
      <Header locale={locale} />
      <main id="main-content">{children}</main>
      <Footer locale={locale} />
      <MobileNavigation locale={locale} />
    </div>
  );
}
