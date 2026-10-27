"use client";
import { formatMoney } from "@/lib/currency";
import type { SimcoinsCheckoutQuote } from "@/lib/simcoins/checkout";
import { SimcoinIcon } from "./art";

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
    <aside className="commerce-card sc-checkout-rewards" aria-label="SimCoins">
      <div className="sc-checkout-rewards-title">
        <SimcoinIcon size={26} />
        <strong>SimCoins</strong>
      </div>
      <p>
        {quote.firstPurchase
          ? es
            ? "Tu primera compra elegible desbloquea tu próximo nivel."
            : "Your first eligible purchase unlocks your next level."
          : es
            ? `${quote.earnedCoins} SimCoins pendientes con esta compra.`
            : `${quote.earnedCoins} pending SimCoins with this purchase.`}
      </p>
      {quote.maxRedeemCoins > 0 && (
        <label className="sc-checkout-redeem">
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
      <details className="sc-checkout-reward-conditions">
        <summary>
          {es ? "Condiciones de la recompensa" : "Reward conditions"}
        </summary>
        <p>
          {es
            ? "Las monedas se liberan después del pago, la entrega verificada y el plazo del programa. Solo cuentan los importes y planes elegibles. El canje no se combina automáticamente con otras promociones."
            : "Coins become available after payment, verified delivery and the program waiting period. Only eligible amounts and plans qualify. Redemption does not automatically combine with other promotions."}
        </p>
      </details>
    </aside>
  );
}
