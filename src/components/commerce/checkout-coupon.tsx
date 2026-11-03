"use client";

import { useState } from "react";
import { Check, Tag, LoaderCircle, X } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import type { CouponDetails, CouponQuote } from "@/lib/payments/coupons";

export type CheckoutCouponQuote = CouponQuote;

export function couponErrorMessage(code: string, es: boolean) {
  if (code === "coupon_minimum")
    return es
      ? "Tu pedido no alcanza la compra mínima indicada para este cupón."
      : "Your order does not meet the minimum spend shown for this coupon.";
  if (code === "rate_limit")
    return es
      ? "Espera un momento antes de volver a aplicar el código."
      : "Wait a moment before applying the code again.";
  if (
    ["coupon_expired", "quote_expired", "coupon_quote_expired"].includes(code)
  )
    return es
      ? "El descuento venció. Aplica el código de nuevo y revisa el total."
      : "The discount expired. Apply the code again and review the total.";
  if (code === "coupon_limit")
    return es
      ? "Este código ya alcanzó su límite de uso."
      : "This code has reached its usage limit.";
  if (code === "coupon_margin")
    return es
      ? "Este pedido no admite este descuento. Puedes aplicarlo a otra selección de planes."
      : "This order is not eligible for this discount. You can apply it to a different selection of plans.";
  if (["coupon_cost_unavailable", "coupon_unavailable"].includes(code))
    return es
      ? "No pudimos verificar el descuento en este momento. Espera unos segundos y vuelve a aplicarlo."
      : "We could not verify the discount right now. Wait a few seconds and apply it again.";
  if (code === "invalid_coupon")
    return es
      ? "Código no válido. Comprueba que esté bien escrito."
      : "Invalid code. Check the spelling and try again.";
  return es
    ? "No se puede aplicar este código a este pedido. Prueba otro código o continúa sin descuento."
    : "This code cannot be applied to this order. Try another code or continue without a discount.";
}

export function CheckoutCoupon({
  locale,
  quote,
  busy,
  disabled,
  ready,
  error,
  onApply,
  onRemove,
}: {
  locale: Locale;
  quote: CheckoutCouponQuote | null;
  busy: boolean;
  disabled: boolean;
  ready: boolean;
  error: string;
  onApply: (code: string) => void;
  onRemove: () => void;
  details?: CouponDetails | null;
  onCheck?: (code: string) => void;
}) {
  const es = locale === "es";
  const [code, setCode] = useState("");
  const submitCode = () => onApply(code.trim());
  return (
    <div className="checkout-coupon" aria-busy={busy}>
      <div className="checkout-coupon-heading">
        <Tag size={19} aria-hidden="true" />
        <strong>{es ? "Código de descuento" : "Discount code"}</strong>
      </div>
      {quote ? (
        <div role="status">
          <div className="checkout-coupon-applied">
            <span>
              <Check size={16} aria-hidden="true" />
              <strong>{quote.code}</strong>
              <span>
                {es ? "Ahorras " : "You save "}
                {formatMoney(quote.discountTotal, quote.currency, locale)}
              </span>
            </span>
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              aria-label={
                es ? "Quitar código de descuento" : "Remove discount code"
              }
            >
              <X size={17} aria-hidden="true" />
            </button>
          </div>
          <p className="commerce-muted">
            {es
              ? "Este cupón no acumula ni canjea SimCoins."
              : "This coupon does not earn or redeem SimCoins."}
          </p>
        </div>
      ) : (
        <>
          <div id="checkout-coupon-fields" className="checkout-coupon-fields">
            <label className="sr-only" htmlFor="checkout-coupon-code">
              {es ? "Código de descuento" : "Discount code"}
            </label>
            <div>
              <input
                id="checkout-coupon-code"
                name="discountCode"
                placeholder={es ? "Introduce tu código" : "Enter your code"}
                aria-invalid={!!error}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={40}
                value={code}
                disabled={disabled || busy}
                aria-describedby={
                  [
                    !ready && "checkout-coupon-hint",
                    error && "checkout-coupon-error",
                  ]
                    .filter(Boolean)
                    .join(" ") || undefined
                }
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    if (ready && !disabled && !busy && code.trim())
                      submitCode();
                  }
                }}
              />
              <button
                type="button"
                disabled={disabled || busy || !ready || !code.trim()}
                onClick={submitCode}
              >
                {busy ? (
                  <LoaderCircle
                    size={16}
                    className="payment-spinner"
                    aria-hidden="true"
                  />
                ) : null}
                {busy
                  ? es
                    ? "Verificando…"
                    : "Checking…"
                  : es
                    ? "Aplicar"
                    : "Apply"}
              </button>
            </div>
            {!ready && (
              <p id="checkout-coupon-hint" className="commerce-muted">
                {es
                  ? "Introduce tu correo arriba para aplicar el descuento."
                  : "Enter your email above to apply your discount."}
              </p>
            )}
            <p className="commerce-muted">
              {es
                ? "Un cupón por compra. No se combina con SimCoins."
                : "One code per order. Cannot be combined with SimCoins."}
            </p>
          </div>
        </>
      )}
      {error && (
        <p
          id="checkout-coupon-error"
          className="checkout-coupon-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
