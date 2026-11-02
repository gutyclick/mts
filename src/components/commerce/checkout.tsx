"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { legalVersion } from "@/lib/legal-version";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CircleHelp,
  LockKeyhole,
  LoaderCircle,
  Mail,
  ShoppingBag,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { pathFor } from "@/lib/i18n";
import { authPath } from "@/lib/auth-routes";
import { experiencePath } from "@/lib/experience-routes";
import type { CartLine } from "@/lib/cart";
import { cartTotal } from "@/lib/cart";
import { formatMoney, currencyCode, type Currency } from "@/lib/currency";
import { useCurrency } from "@/components/currency-provider";
import { CartItems, useCart } from "./cart-provider";
import {
  CheckoutPaymentFields,
  PaymentDetailsError,
  type PaymentFieldsHandle,
} from "./checkout-payment-fields";
import { confirmPreparedPayment } from "@/lib/payments/confirm-prepared-payment";
import type { StripeCheckoutElementsSdk } from "@stripe/stripe-js";
import { HoldCountdown, usePaymentPresence } from "./payment-hold";
import { paymentFormMatchesMode } from "@/lib/payments/checkout-mode";
import { CheckoutRewards } from "@/components/simcoins/checkout-rewards";
import type { SimcoinsCheckoutQuote } from "@/lib/simcoins/checkout";
import { recordSimcoinsStats } from "@/lib/simcoins/analytics-client";
import { couponQuoteSchema } from "@/lib/payments/coupons";
import {
  CheckoutCoupon,
  couponErrorMessage,
  type CheckoutCouponQuote,
} from "./checkout-coupon";
import "@/app/checkout-coupons.css";

export function Checkout({
  locale,
  email,
  initial,
}: {
  locale: Locale;
  email?: string;
  initial?: CartLine;
}) {
  const es = locale === "es";
  const form = useRef<HTMLFormElement>(null);
  const paymentFields = useRef<PaymentFieldsHandle>(null);
  const checkoutSdk = useRef<{
    secret: string;
    sdk: StripeCheckoutElementsSdk;
  } | null>(null);
  const [fieldsReady, setFieldsReady] = useState(false);
  const cart = useCart();
  const pricing = useCurrency();
  const initialized = useRef(false);
  const [testMode, setTestMode] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [simcoinsEnabled, setSimcoinsEnabled] = useState(false);
  const [useCoins, setUseCoins] = useState(false);
  const [rewards, setRewards] = useState<{
    key: string;
    quote: SimcoinsCheckoutQuote;
  } | null>(null);
  const [rewardsBusy, setRewardsBusy] = useState(false);
  const [coupon, setCoupon] = useState<{
    key: string;
    quote: CheckoutCouponQuote;
  } | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState("");
  const couponRequest = useRef<AbortController | null>(null);
  const [rewardsRefresh, setRewardsRefresh] = useState(0);
  const [rewardsSettled, setRewardsSettled] = useState("");
  const [publishableKey, setPublishableKey] = useState("");
  const [buyerEmail, setBuyerEmail] = useState(email ?? "");
  const [differentRecipient, setDifferentRecipient] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [payment, setPayment] = useState<{
    key: string;
    clientSecret: string;
    orderId: string;
    total: number;
    currency: Currency;
    buyer: string;
    recipient: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [compatible, setCompatible] = useState(false);
  const [terms, setTerms] = useState(false);
  const paymentAttempt = useRef<{ key: string; id: string } | null>(null);
  const submitting = useRef(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/checkout/config", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.ok) {
          const data = await response.json();
          setEnabled(data.enabled === true);
          setSimcoinsEnabled(data.simcoinsEnabled === true);
          setTestMode(data.mode === "test");
          setPublishableKey(
            typeof data.publishableKey === "string" ? data.publishableKey : "",
          );
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  useEffect(() => {
    if (!initial || initialized.current) return;
    initialized.current = true;
    cart.ensure(initial);
  }, [initial, cart]);
  const count = cart.lines.reduce((sum, item) => sum + item.quantity, 0);
  const next = encodeURIComponent(experiencePath(locale, "checkout"));
  const total = cartTotal(cart.resolved);
  const grossPaymentTotal =
    total === null
      ? null
      : pricing.total(
          cart.resolved.items.map((item) => ({
            unit: item.retailPriceCents!,
            quantity: item.quantity,
          })),
        );
  const couponKey = JSON.stringify([
    cart.lines,
    buyerEmail.trim().toLowerCase(),
    pricing.currency,
    pricing.quote?.id ?? null,
    grossPaymentTotal,
  ]);
  const latestCouponKey = useRef(couponKey);
  const couponQuote = coupon?.key === couponKey ? coupon.quote : null;
  const couponReady =
    enabled &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyerEmail.trim()) &&
    pricing.ready &&
    !pricing.busy &&
    !cart.loading &&
    !cart.error &&
    grossPaymentTotal !== null;
  useEffect(() => {
    latestCouponKey.current = couponKey;
    couponRequest.current?.abort();
    queueMicrotask(() => {
      setCouponBusy(false);
      setCoupon((current) => (current?.key === couponKey ? current : null));
    });
    return () => couponRequest.current?.abort();
  }, [couponKey]);
  useEffect(() => {
    if (!couponQuote) return;
    const timeout = window.setTimeout(
      () => {
        setCoupon(null);
        setCouponError(couponErrorMessage("coupon_expired", es));
      },
      Math.max(
        0,
        Math.min(2147483647, Date.parse(couponQuote.expiresAt) - Date.now()),
      ),
    );
    return () => window.clearTimeout(timeout);
  }, [couponQuote, es]);
  async function applyCoupon(code: string) {
    if (!couponReady || busy || couponBusy || activePayment) return;
    couponRequest.current?.abort();
    const controller = new AbortController();
    couponRequest.current = controller;
    const key = couponKey;
    setCouponBusy(true);
    setCouponError("");
    try {
      const response = await fetch("/api/checkout/coupon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          code,
          email: buyerEmail.trim(),
          lines: cart.lines,
          currency: pricing.currency,
          fxQuoteId: pricing.quote?.id ?? null,
        }),
      });
      const data = await response.json();
      if (controller.signal.aborted || latestCouponKey.current !== key) return;
      if (!response.ok || !data.quote) {
        setCouponError(couponErrorMessage(data.error, es));
        if (["quote_expired", "coupon_expired"].includes(data.error))
          await pricing.select(pricing.currency);
        return;
      }
      const parsedQuote = couponQuoteSchema.safeParse(data.quote);
      if (
        !parsedQuote.success ||
        parsedQuote.data.currency !== pricing.currency
      )
        throw Error("Invalid coupon quote");
      if (Date.parse(parsedQuote.data.expiresAt) <= Date.now()) {
        setCouponError(couponErrorMessage("coupon_expired", es));
        return;
      }
      setUseCoins(false);
      setCoupon({ key, quote: parsedQuote.data });
    } catch {
      if (!controller.signal.aborted)
        setCouponError(
          es
            ? "No pudimos comprobar el código. Vuelve a intentarlo."
            : "We could not check the code. Try again.",
        );
    } finally {
      if (!controller.signal.aborted) setCouponBusy(false);
    }
  }
  const rewardsKey = JSON.stringify([
    cart.lines,
    pricing.currency,
    pricing.quote?.id ?? null,
    useCoins,
    rewardsRefresh,
  ]);
  const rewardsQuote =
    !couponQuote && rewards?.key === rewardsKey ? rewards.quote : null;
  const effectiveRewardsBusy = !couponQuote && rewardsBusy;
  const paymentTotal =
    couponQuote?.paymentTotal ??
    rewardsQuote?.paymentTotal ??
    grossPaymentTotal;
  useEffect(() => {
    if (
      !!couponQuote ||
      !simcoinsEnabled ||
      !email ||
      !pricing.ready ||
      cart.loading ||
      cart.error ||
      !cart.lines.length
    )
      return;
    const controller = new AbortController();
    queueMicrotask(() => {
      if (!controller.signal.aborted) setRewardsBusy(true);
    });
    fetch("/api/simcoins/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        lines: cart.lines,
        currency: pricing.currency,
        fxQuoteId: pricing.quote?.id ?? null,
        useCoins,
      }),
    })
      .then(async (response) => {
        const data = await response.json();
        if (!controller.signal.aborted)
          setRewards(
            response.ok && data.available && data.quote
              ? { key: rewardsKey, quote: data.quote }
              : null,
          );
      })
      .catch(() => {})
      .finally(() => {
        if (!controller.signal.aborted) {
          setRewardsBusy(false);
          setRewardsSettled(rewardsKey);
        }
      });
    return () => controller.abort();
  }, [
    couponQuote,
    simcoinsEnabled,
    email,
    pricing.ready,
    cart.loading,
    cart.error,
    rewardsKey,
    cart.lines,
    pricing.currency,
    pricing.quote?.id,
    useCoins,
  ]);
  const checkoutKey = JSON.stringify([
    cart.lines,
    buyerEmail.trim(),
    differentRecipient,
    recipientEmail.trim(),
    marketingOptIn,
    total,
    locale,
    pricing.currency,
    pricing.quote?.id,
    paymentTotal,
    rewardsQuote?.id ?? null,
    couponQuote?.id ?? null,
  ]);
  const activePayment = payment?.key === checkoutKey ? payment : null;
  const latestCheckoutKey = useRef(checkoutKey);
  useEffect(() => {
    latestCheckoutKey.current = checkoutKey;
  }, [checkoutKey]);
  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (couponQuote && Date.parse(couponQuote.expiresAt) <= Date.now()) {
      setCoupon(null);
      setCouponError(couponErrorMessage("coupon_expired", es));
      return;
    }
    if (rewardsQuote && Date.parse(rewardsQuote.expiresAt) <= Date.now()) {
      setRewards(null);
      setRewardsRefresh((value) => value + 1);
      setError(
        es
          ? "Actualizamos tus SimCoins. Revisa el total antes de continuar."
          : "We refreshed your SimCoins. Review the total before continuing.",
      );
      return;
    }
    if (
      submitting.current ||
      couponBusy ||
      effectiveRewardsBusy ||
      (!couponQuote &&
        simcoinsEnabled &&
        !!email &&
        rewardsSettled !== rewardsKey) ||
      !enabled ||
      total == null ||
      paymentTotal == null ||
      !pricing.ready ||
      !!pricing.busy ||
      cart.loading ||
      cart.error ||
      !compatible ||
      !terms ||
      !fieldsReady
    )
      return;
    if (
      pricing.quote?.expiresAt &&
      new Date(pricing.quote.expiresAt).getTime() <= Date.now()
    ) {
      await pricing.select(pricing.currency);
      setError(
        es
          ? "Actualizamos la cotización. Revisa el total antes de continuar."
          : "We refreshed the exchange rate. Review the total before continuing.",
      );
      return;
    }
    const recipient = differentRecipient
      ? recipientEmail.trim()
      : buyerEmail.trim();
    const key = checkoutKey;
    if (paymentAttempt.current?.key !== key)
      paymentAttempt.current = { key, id: crypto.randomUUID() };
    submitting.current = true;
    setBusy(true);
    setError("");
    pricing.setPaymentBusy(true);
    let collected:
      Awaited<ReturnType<PaymentFieldsHandle["collect"]>> | undefined;
    try {
      collected = await paymentFields.current?.collect();
      if (!collected) throw Error("Payment fields unavailable");
      if (latestCheckoutKey.current !== key)
        throw Error("Checkout changed during payment collection");
      const response = await fetch("/api/checkout/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: paymentAttempt.current.id,
          locale,
          email: buyerEmail.trim(),
          differentRecipient,
          ...(differentRecipient ? { recipientEmail: recipient } : {}),
          marketingOptIn,
          holdPolicy: "leave-v1",
          lines: cart.lines,
          expectedTotal: total,
          currency: pricing.currency,
          fxQuoteId: pricing.quote?.id ?? null,
          ...(couponQuote
            ? { couponQuoteId: couponQuote.id }
            : rewardsQuote
              ? { simcoinsQuoteId: rewardsQuote.id }
              : {}),
          expectedPaymentTotal: paymentTotal,
          compatible: true,
          terms: true,
          legalVersion,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        collected.fail();
        if (
          [
            "checkout_expired",
            "price_changed",
            "attempt_conflict",
            "quote_expired",
            "simcoins_quote_expired",
            "coupon_quote_expired",
            "coupon_unavailable",
            "coupon_limit",
          ].includes(data.error)
        )
          paymentAttempt.current = null;
        if (["price_changed", "unavailable_plan"].includes(data.error))
          cart.retry();
        if (data.error === "quote_expired")
          await pricing.select(pricing.currency);
        if (
          typeof data.error === "string" &&
          data.error.startsWith("coupon_")
        ) {
          setCoupon(null);
          setCouponError(couponErrorMessage(data.error, es));
        }
        if (data.error === "simcoins_quote_expired") {
          setRewards(null);
          setUseCoins(false);
          setRewardsRefresh((value) => value + 1);
        }
        const messages: Record<string, string> = es
          ? {
              quote_expired:
                "La cotización ha vencido. Revisa el total actualizado y vuelve a continuar.",
              price_changed:
                "El precio ha cambiado. Revisa el nuevo total antes de continuar.",
              unavailable_plan:
                "Un plan necesita actualizarse. Revisa tu carrito y vuelve a intentarlo.",
              checkout_rate_limit:
                "Has hecho varios intentos. Espera un poco antes de volver a probar.",
              checkout_expired:
                "La sesión ha vencido. Pulsa de nuevo para iniciar el pago.",
              cookies_required:
                "Permite las cookies necesarias y recarga esta página para continuar.",
            }
          : {
              quote_expired:
                "The exchange quote expired. Review the updated total and continue again.",
              price_changed:
                "The price has changed. Review the updated total before continuing.",
              unavailable_plan:
                "A plan needs updating. Review your cart and try again.",
              checkout_rate_limit:
                "You have made several attempts. Please wait before trying again.",
              checkout_expired:
                "This session has expired. Press again to start payment.",
              cookies_required:
                "Allow necessary cookies and reload this page to continue.",
            };
        setError(
          messages[data.error] ??
            (es
              ? "No pudimos abrir el pago. Tu carrito sigue guardado. Vuelve a intentarlo."
              : "We couldn’t open payment. Your cart is saved. Please try again."),
        );
        return;
      }
      if (data.url) {
        const url = new URL(data.url);
        if (url.origin !== window.location.origin)
          throw new Error("Invalid redirect");
        window.location.assign(url.href);
      } else {
        if (
          !paymentFormMatchesMode(
            data.clientSecret,
            publishableKey,
            testMode ? "test" : "live",
          )
        )
          throw new Error("Invalid payment form");
        const confirmedCurrency = currencyCode(
          data.paymentCurrency ?? (pricing.currency === "USD" ? "USD" : null),
        );
        const confirmedTotal =
          data.paymentTotal ?? (pricing.currency === "USD" ? total : null);
        if (
          confirmedCurrency !== pricing.currency ||
          confirmedTotal !== paymentTotal ||
          latestCheckoutKey.current !== key
        )
          throw Error("Payment total mismatch");
        setPayment({
          key,
          clientSecret: data.clientSecret,
          orderId: data.orderId,
          total: confirmedTotal,
          currency: confirmedCurrency,
          buyer: buyerEmail.trim(),
          recipient,
        });
        if (checkoutSdk.current?.secret !== data.clientSecret)
          checkoutSdk.current = {
            secret: data.clientSecret,
            sdk: collected.stripe.initCheckoutElementsSdk({
              clientSecret: data.clientSecret,
            }),
          };
        const sdk = checkoutSdk.current?.sdk;
        if (!sdk) throw Error("Payment initialization unavailable");
        const result = await confirmPreparedPayment(
          sdk,
          {
            live: !testMode,
            currency: confirmedCurrency,
            total: confirmedTotal,
          },
          collected.paymentMethod,
        );
        if (result.type === "error") {
          collected.fail();
          setError(result.error.message);
        }
      }
    } catch (error) {
      collected?.fail();
      setError(
        error instanceof PaymentDetailsError
          ? error.message
          : es
            ? "No pudimos conectar con el pago. Tu carrito sigue guardado. Vuelve a intentarlo."
            : "We couldn’t connect to payment. Your cart is saved. Please try again.",
      );
    } finally {
      submitting.current = false;
      pricing.setPaymentBusy(false);
      setBusy(false);
    }
  }
  return (
    <div className="container commerce-checkout checkout-streamlined">
      <Link className="commerce-back" href={pathFor(locale, "destinations")}>
        <ArrowLeft size={16} />
        {es ? "Seguir explorando" : "Keep exploring"}
      </Link>
      <header className="commerce-checkout-heading">
        <p className="eyebrow">MYTRIPSIM / {es ? "TU VIAJE" : "YOUR TRIP"}</p>
        <h1>
          {es ? "Tu conexión, a un paso." : "Your connection, one step away."}
        </h1>
      </header>
      {!count ? (
        <section className="commerce-card">
          <CartItems locale={locale} />
        </section>
      ) : (
        <div className="commerce-checkout-grid">
          <section className="commerce-checkout-main">
            {!email && !activePayment && (
              <p className="checkout-account-inline">
                {es ? "¿Ya tienes cuenta?" : "Already have an account?"}{" "}
                <Link href={authPath(locale, "login") + "?next=" + next}>
                  {es ? "Inicia sesión" : "Sign in"}
                </Link>
                <span aria-hidden="true"> · </span>
                <Link href={authPath(locale, "register") + "?next=" + next}>
                  {es ? "Crea una cuenta" : "Create an account"}
                </Link>
              </p>
            )}
            <form
              ref={form}
              className="commerce-card checkout-form"
              onSubmit={pay}
            >
              <header>
                <h2>{es ? "Contacto" : "Contact"}</h2>
              </header>
              <label htmlFor="checkout-email">
                {es ? "Correo electrónico" : "Email address"}
                <span className="account-input">
                  <Mail size={18} aria-hidden="true" />
                  <input
                    id="checkout-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    maxLength={254}
                    required
                    value={buyerEmail}
                    onChange={(event) => setBuyerEmail(event.target.value)}
                    disabled={busy}
                    readOnly={!!email}
                    aria-describedby="checkout-email-hint"
                    placeholder={es ? "tu@correo.com" : "you@example.com"}
                  />
                </span>
              </label>
              <p id="checkout-email-hint" className="commerce-muted">
                {email
                  ? es
                    ? "Correo verificado de tu cuenta."
                    : "Your verified account email."
                  : es
                    ? "Aquí recibirás tu QR y las instrucciones."
                    : "Your QR and instructions will arrive here."}
              </p>
              {email && (
                <Link
                  href={experiencePath(locale, "wallet")}
                  className="checkout-session"
                >
                  <BadgeCheck size={16} />
                  {es
                    ? "Sesión iniciada · Ir a Mis TripSim"
                    : "Signed in · Go to My TripSim"}
                </Link>
              )}
              <label className="commerce-checkbox checkout-marketing">
                <input
                  type="checkbox"
                  name="marketingOptIn"
                  checked={marketingOptIn}
                  onChange={(event) => setMarketingOptIn(event.target.checked)}
                  disabled={busy}
                />
                <span>
                  {es
                    ? "Quiero recibir novedades y ofertas de MyTripSim por correo. (Opcional)"
                    : "I’d like to receive MyTripSim news and offers by email. (Optional)"}
                </span>
              </label>
              <section
                className="checkout-beneficiary"
                aria-label={es ? "Beneficiario de la eSIM" : "eSIM recipient"}
              >
                <label className="commerce-checkbox">
                  <input
                    type="checkbox"
                    name="differentRecipient"
                    checked={differentRecipient}
                    onChange={(event) =>
                      setDifferentRecipient(event.target.checked)
                    }
                    disabled={busy}
                  />
                  <span>
                    {es
                      ? "Enviar la eSIM a otra persona"
                      : "Send the eSIM to someone else"}
                  </span>
                </label>
                {differentRecipient && (
                  <label htmlFor="checkout-recipient-email">
                    {es ? "Correo del beneficiario" : "Recipient email"}
                    <span className="account-input">
                      <Mail size={18} aria-hidden="true" />
                      <input
                        id="checkout-recipient-email"
                        name="recipientEmail"
                        type="email"
                        inputMode="email"
                        autoComplete="section-beneficiary email"
                        maxLength={254}
                        value={recipientEmail}
                        onChange={(event) =>
                          setRecipientEmail(event.target.value)
                        }
                        disabled={busy}
                        required
                        placeholder={
                          es
                            ? "beneficiario@correo.com"
                            : "recipient@example.com"
                        }
                      />
                    </span>
                  </label>
                )}
              </section>
              {activePayment && (
                <PreparedPaymentHold
                  orderId={activePayment.orderId}
                  locale={locale}
                />
              )}
              <div className="checkout-payment">
                <h2>{es ? "Pago seguro" : "Secure payment"}</h2>
                <span className="checkout-stripe-note">
                  <LockKeyhole size={13} aria-hidden="true" />
                  {enabled
                    ? testMode
                      ? es
                        ? "Modo de pruebas"
                        : "Test mode"
                      : "Stripe"
                    : es
                      ? "Conectando…"
                      : "Connecting…"}
                </span>
              </div>
              {enabled &&
                publishableKey &&
                paymentTotal != null &&
                pricing.ready && (
                  <CheckoutPaymentFields
                    key={pricing.currency + ":" + paymentTotal}
                    ref={paymentFields}
                    publishableKey={publishableKey}
                    locale={locale}
                    total={paymentTotal}
                    currency={pricing.currency}
                    email={buyerEmail}
                    canPay={
                      terms &&
                      compatible &&
                      !busy &&
                      !effectiveRewardsBusy &&
                      !couponBusy &&
                      !cart.loading &&
                      !cart.error &&
                      !pricing.busy
                    }
                    onReady={setFieldsReady}
                    onSubmit={() => {
                      if (!form.current?.reportValidity()) return false;
                      form.current.requestSubmit();
                      return true;
                    }}
                  />
                )}
              <CheckoutCoupon
                locale={locale}
                quote={couponQuote}
                busy={couponBusy}
                disabled={busy || !!activePayment}
                ready={couponReady}
                error={couponError}
                onApply={(code) => void applyCoupon(code)}
                onRemove={() => {
                  setCoupon(null);
                  setCouponError("");
                }}
              />
              <label className="commerce-checkbox">
                <input
                  type="checkbox"
                  name="compatible"
                  required
                  disabled={busy}
                  checked={compatible}
                  onChange={(e) => setCompatible(e.target.checked)}
                />
                <span>
                  {es
                    ? "Mi dispositivo es compatible con eSIM y está desbloqueado."
                    : "My device supports eSIM and is carrier-unlocked."}{" "}
                  <Link href={pathFor(locale, "compatibility")}>
                    {es ? "Comprobar" : "Check"}
                  </Link>
                </span>
              </label>
              <label className="commerce-checkbox">
                <input
                  type="checkbox"
                  name="terms"
                  required
                  disabled={busy}
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                />
                <span>
                  {es ? "Acepto los" : "I agree to the"}{" "}
                  <Link href={pathFor(locale, "terms")}>
                    {es ? "términos" : "terms"}
                  </Link>{" "}
                  {es ? "y la" : "and"}{" "}
                  <Link href={pathFor(locale, "refunds")}>
                    {es ? "política de reembolsos" : "refund policy"}
                  </Link>
                  {es ? " y he leído el " : " and have read the "}
                  <Link href={pathFor(locale, "privacy")}>
                    {es ? "aviso de privacidad" : "privacy notice"}
                  </Link>
                  .
                </span>
              </label>
              <button
                type="submit"
                className="button button-primary checkout-pay"
                disabled={
                  !enabled ||
                  busy ||
                  couponBusy ||
                  effectiveRewardsBusy ||
                  cart.loading ||
                  cart.error ||
                  total == null ||
                  paymentTotal == null ||
                  !pricing.ready ||
                  !!pricing.busy ||
                  !compatible ||
                  !terms ||
                  !fieldsReady
                }
                aria-describedby="checkout-payment-note"
              >
                {busy ? (
                  <LoaderCircle size={17} className="payment-spinner" />
                ) : (
                  <LockKeyhole size={17} />
                )}
                {busy
                  ? es
                    ? "Preparando tu pago…"
                    : "Preparing payment…"
                  : `${es ? "Pagar" : "Pay"} ${paymentTotal == null ? "" : formatMoney(paymentTotal, pricing.currency, locale)}${testMode ? (es ? " (prueba)" : " (test)") : ""}`}
              </button>
              {pricing.error && (
                <div className="checkout-error" role="alert">
                  <p>
                    {es
                      ? "No pudimos actualizar los precios en esta moneda. Reintenta o elige USD en el selector."
                      : "We could not update prices in this currency. Retry or choose USD in the selector."}
                  </p>
                  <button
                    type="button"
                    className="commerce-link"
                    disabled={!!pricing.busy}
                    onClick={() => void pricing.select(pricing.currency)}
                  >
                    {es ? "Actualizar moneda" : "Refresh currency"}
                  </button>
                </div>
              )}
              {error && (
                <p className="checkout-error" role="alert">
                  {error}
                </p>
              )}
              <p id="checkout-payment-note" className="commerce-muted">
                {enabled && testMode
                  ? es
                    ? "Esta compra es de prueba: no se harán cargos ni se enviarán QR de eSIM reales."
                    : "This is a test purchase: no real charges or eSIM QR codes will be sent."
                  : es
                    ? "El QR y las instrucciones se enviarán al correo del beneficiario tras confirmar el pago y preparar la eSIM."
                    : "The QR code and instructions will be sent to the recipient after payment is confirmed and the eSIM is ready."}
              </p>
            </form>
            <div className="checkout-help">
              <CircleHelp size={19} />
              <p>
                {es
                  ? "¿Una duda antes de viajar?"
                  : "A question before you go?"}{" "}
                <Link href={pathFor(locale, "faq")}>
                  {es
                    ? "Visita nuestras preguntas frecuentes"
                    : "Visit our FAQs"}
                  <ArrowRight size={14} />
                </Link>
              </p>
            </div>
          </section>
          <aside
            className="commerce-card checkout-summary"
            aria-label={es ? "Resumen del pedido" : "Order summary"}
          >
            <header>
              <h2>
                <ShoppingBag size={20} />
                {es ? "Tu viaje" : "Your trip"}
              </h2>
              <span>
                {count} {count === 1 ? "eSIM" : "eSIMs"}
              </span>
            </header>
            <div inert={busy || couponBusy}>
              <CartItems locale={locale} />
            </div>
            {rewardsQuote && (
              <CheckoutRewards
                locale={locale}
                quote={rewardsQuote}
                useCoins={useCoins}
                busy={busy || rewardsBusy || !!activePayment}
                onUseCoins={(value) => {
                  setUseCoins(value);
                  if (value) recordSimcoinsStats("simcoins_checkout_redeem");
                }}
              />
            )}
            <div className="checkout-price-breakdown">
              <div>
                <span>{es ? "Subtotal" : "Subtotal"}</span>
                <span>
                  {grossPaymentTotal == null
                    ? "—"
                    : formatMoney(grossPaymentTotal, pricing.currency, locale)}
                </span>
              </div>
              {(couponQuote ||
                (rewardsQuote &&
                  rewardsQuote.paymentTotal < (grossPaymentTotal ?? 0))) && (
                <div className="checkout-discount">
                  <span>
                    {couponQuote ? (es ? "Descuento" : "Discount") : "SimCoins"}
                  </span>
                  <span>
                    −
                    {formatMoney(
                      couponQuote?.discountTotal ??
                        (grossPaymentTotal ?? 0) -
                          (rewardsQuote?.paymentTotal ?? 0),
                      pricing.currency,
                      locale,
                    )}
                  </span>
                </div>
              )}
            </div>
            <div className="checkout-total">
              <span>{es ? "Total" : "Total"}</span>
              <strong>
                {!cart.loading &&
                !cart.error &&
                cartTotal(cart.resolved) != null
                  ? paymentTotal === null
                    ? "—"
                    : formatMoney(paymentTotal, pricing.currency, locale)
                  : es
                    ? "Por confirmar"
                    : "To be confirmed"}
              </strong>
            </div>
            <p className="commerce-muted">
              {es
                ? "Cada unidad corresponde a una eSIM para un dispositivo."
                : "Each unit is one eSIM for one device."}
            </p>
            <div className="checkout-delivery">
              <Mail size={20} />
              <div>
                <strong>{es ? "Entrega digital" : "Digital delivery"}</strong>
                <p>
                  {es
                    ? "QR e instrucciones por correo tras confirmar el pago y emitir tu eSIM."
                    : "QR and instructions by email once payment is confirmed and your eSIM is issued."}
                </p>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

function PreparedPaymentHold({
  orderId,
  locale,
}: {
  orderId: string;
  locale: Locale;
}) {
  const root = useRef<HTMLDivElement>(null);
  const presence = usePaymentPresence(orderId, root);
  return (
    <div ref={root}>
      {presence.state?.holdExpiresAt && (
        <HoldCountdown
          deadline={presence.state.holdExpiresAt}
          serverTime={presence.state.serverTime}
          locale={locale}
        />
      )}
    </div>
  );
}
