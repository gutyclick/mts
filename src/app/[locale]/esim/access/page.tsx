import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isLocale } from "@/lib/i18n";
import { EsimDelivery } from "@/components/commerce/esim-delivery";
export const metadata: Metadata = {
  title: "Tu eSIM | MyTripSim",
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
  return (
    <div className="container esim-access-page">
      <p className="eyebrow">
        MYTRIPSIM / {locale === "es" ? "TU CONEXIÓN" : "YOUR CONNECTION"}
      </p>
      <h1>
        {locale === "es"
          ? "Tu viaje empieza aquí."
          : "Your journey starts here."}
      </h1>
      <EsimDelivery locale={locale} guest />
    </div>
  );
}
