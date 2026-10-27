"use client";
import { useCurrency } from "./currency-provider";
import { convertUsdMinor, formatMoney } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
export function Price({
  cents,
  locale,
  quantity = 1,
}: {
  cents: number;
  locale: Locale;
  quantity?: number;
}) {
  const pricing = useCurrency();
  return (
    <span aria-busy={!pricing.ready}>
      {pricing.quote
        ? formatMoney(
            convertUsdMinor(cents, pricing.currency, pricing.quote.rate) *
              quantity,
            pricing.currency,
            locale,
          )
        : "—"}
    </span>
  );
}
export function CartPrice({
  items,
  locale,
}: {
  items: { unit: number; quantity: number }[];
  locale: Locale;
}) {
  const pricing = useCurrency(),
    total = pricing.total(items);
  return (
    <span aria-busy={!pricing.ready}>
      {total === null ? "—" : formatMoney(total, pricing.currency, locale)}
    </span>
  );
}
