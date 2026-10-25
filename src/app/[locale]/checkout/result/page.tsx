import { notFound } from "next/navigation";
import { z } from "zod";
import { isLocale } from "@/lib/i18n";
import { PaymentResult } from "@/components/commerce/payment-result";

export const metadata = {
  title: "MyTripSim · Pedido / Order",
  robots: { index: false, follow: false },
};
export default async function ResultPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  if (
    !isLocale(locale) ||
    typeof query.order !== "string" ||
    !z.uuid().safeParse(query.order).success
  )
    notFound();
  return (
    <PaymentResult
      locale={locale}
      orderId={query.order}
      cancelled={query.cancelled === "1"}
    />
  );
}
