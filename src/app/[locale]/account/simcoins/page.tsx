import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import {
  customerSession,
  customerRecords,
  customerCheckoutOrders,
} from "@/lib/customer-data";
import { getCustomerSimcoins } from "@/lib/simcoins/server";
import { SimcoinsWalletView } from "@/components/simcoins/wallet";
import "@/styles/simcoins.css";
export const metadata: Metadata = {
  title: "SimCoins",
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
  const { client, user } = await customerSession(
    locale,
    `/${locale}/account/simcoins`,
  );
  const [data, records, orders] = await Promise.all([
    getCustomerSimcoins(user.id),
    customerRecords(client, user.id),
    customerCheckoutOrders(client, user.id),
  ]);
  const name =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.split(" ")[0]
      : locale === "es"
        ? "viajero"
        : "traveler";
  return (
    <SimcoinsWalletView
      locale={locale}
      name={name}
      esimCount={records.esims.length}
      orderCount={orders.length}
      {...data}
    />
  );
}
