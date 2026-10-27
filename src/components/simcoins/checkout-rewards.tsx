"use client";
import { formatMoney } from "@/lib/currency";
import type { SimcoinsCheckoutQuote } from "@/lib/simcoins/checkout";

export function CheckoutRewards({
  locale,
  quote,
  useCoins,
  busy,
  onUseCoins,
}: {
  locale: "es" | "en";
  quote: SimcoinsCheckoutQuote;
  useCoins: boolean;
  busy: boolean;
  onUseCoins: (value: boolean) => void;
}) {
  const es = locale === "es";
  return (
    <aside className="commerce-card" aria-label="SimCoins">
      <strong>SimCoins</strong>
      <p>
        {quote.firstPurchase
          ? es
            ? "Tu primera compra elegible desbloquea Explorer o un nivel superior. Las próximas compras elegibles usan tu nuevo porcentaje."
            : "Your first eligible purchase unlocks Explorer or a higher level. Future eligible purchases use your new rate."
          : es
            ? `Ganarías ${quote.earnedCoins} SimCoins pendientes.`
            : `You could earn ${quote.earnedCoins} pending SimCoins.`}
      </p>
      <p>
        {es
          ? "Se liberan después del pago, la entrega verificada y el plazo del programa."
          : "Released after payment, verified delivery and the program waiting period."}
      </p>
      {quote.maxRedeemCoins > 0 && (
        <label>
          <input
            type="checkbox"
            checked={useCoins}
            disabled={busy}
            onChange={(event) => onUseCoins(event.target.checked)}
          />{" "}
          {es ? "Usar hasta " : "Use up to "}
          {quote.maxRedeemCoins} SimCoins
          {" · "}
          {new Intl.NumberFormat(locale, {
            style: "currency",
            currency: "USD",
          }).format(quote.maxRedeemCoins / 100)}
        </label>
      )}
      {quote.redeemedCoins > 0 && (
        <p>
          {es
            ? `Descuento: ${quote.redeemedCoins} SimCoins. Total: `
            : `Discount: ${quote.redeemedCoins} SimCoins. Total: `}
          {formatMoney(quote.paymentTotal, quote.currency, locale)}
        </p>
      )}
      {quote.earnedCoins === 0 && !quote.firstPurchase && (
        <p>
          {es
            ? "Esta compra no genera SimCoins según tu nivel y la elegibilidad del plan."
            : "This purchase earns no SimCoins under your current level and plan eligibility."}
        </p>
      )}
    </aside>
  );
}
