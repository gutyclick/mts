"use client";

import { useState } from "react";
import { Check, ChevronDown, LoaderCircle, X } from "lucide-react";
import { formatMoney } from "@/lib/currency";
import type { Locale } from "@/lib/i18n";
import type { CouponQuote } from "@/lib/payments/coupons";

export type CheckoutCouponQuote = CouponQuote;

export function couponErrorMessage(code: string, es: boolean) {
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
}) {
  const es = locale === "es";
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  return (
    <div className="checkout-coupon" aria-busy={busy}>
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
          <button
            type="button"
            className="checkout-coupon-toggle"
            aria-expanded={open}
            aria-controls="checkout-coupon-fields"
            disabled={disabled}
            onClick={() => setOpen(!open)}
          >
            {es ? "¿Tienes un código de descuento?" : "Have a discount code?"}
            <ChevronDown size={16} aria-hidden="true" />
          </button>
          {open && (
            <div id="checkout-coupon-fields" className="checkout-coupon-fields">
              <label htmlFor="checkout-coupon-code">
                {es ? "Código de descuento" : "Discount code"}
              </label>
              <div>
                <input
                  id="checkout-coupon-code"
                  name="discountCode"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={40}
                  value={code}
                  disabled={disabled || busy}
                  aria-describedby={!ready ? "checkout-coupon-hint" : undefined}
                  onChange={(event) => setCode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      if (ready && !disabled && !busy && code.trim())
                        onApply(code.trim());
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={disabled || busy || !ready || !code.trim()}
                  onClick={() => onApply(code.trim())}
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
                      ? "Aplicando…"
                      : "Applying…"
                    : es
                      ? "Aplicar"
                      : "Apply"}
                </button>
              </div>
              {!ready && (
                <p id="checkout-coupon-hint" className="commerce-muted">
                  {es
                    ? "Introduce tu correo y espera a que se actualicen los precios."
                    : "Enter your email and wait for prices to update."}
                </p>
              )}
              <p className="commerce-muted">
                {es
                  ? "Los códigos no se combinan con el canje de SimCoins."
                  : "Discount codes cannot be combined with SimCoins redemption."}
              </p>
            </div>
          )}
        </>
      )}
      {error && (
        <p className="checkout-coupon-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
