"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { legalVersion } from "@/lib/legal-version";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CircleHelp,
  CreditCard,
  LockKeyhole,
  LoaderCircle,
  Mail,
  ShoppingBag,
  UserRound,
  Gift,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { pathFor } from "@/lib/i18n";
import { authPath } from "@/lib/auth-routes";
import { experiencePath } from "@/lib/experience-routes";
import type { CartLine } from "@/lib/cart";
import { cartTotal } from "@/lib/cart";
import { formatUSD } from "@/lib/retail-prices";
import { CartItems, useCart } from "./cart-provider";
import { EmbeddedPayment } from "./embedded-payment";
import { paymentFormMatchesMode } from "@/lib/payments/checkout-mode";

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
  const cart = useCart();
  const initialized = useRef(false);
  const [testMode, setTestMode] = useState(false);
  const [enabled, setEnabled] = useState(false);
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
  const checkoutKey = JSON.stringify([
    cart.lines,
    buyerEmail.trim(),
    differentRecipient,
    recipientEmail.trim(),
    marketingOptIn,
    total,
    locale,
  ]);
  const activePayment = payment?.key === checkoutKey ? payment : null;
  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      submitting.current ||
      !enabled ||
      total == null ||
      cart.loading ||
      cart.error ||
      !compatible ||
      !terms
    )
      return;
    const recipient = differentRecipient
      ? recipientEmail.trim()
      : buyerEmail.trim();
    const key = checkoutKey;
    if (paymentAttempt.current?.key !== key)
      paymentAttempt.current = { key, id: crypto.randomUUID() };
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
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
          compatible: true,
          terms: true,
          legalVersion,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (
          ["checkout_expired", "price_changed", "attempt_conflict"].includes(
            data.error,
          )
        )
          paymentAttempt.current = null;
        if (["price_changed", "unavailable_plan"].includes(data.error))
          cart.retry();
        const messages: Record<string, string> = es
          ? {
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
        setPayment({
          key,
          clientSecret: data.clientSecret,
          orderId: data.orderId,
          total,
          buyer: buyerEmail.trim(),
          recipient,
        });
      }
    } catch {
      setError(
        es
          ? "No pudimos conectar con el pago. Tu carrito sigue guardado. Vuelve a intentarlo."
          : "We couldn’t connect to payment. Your cart is saved. Please try again.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="container commerce-checkout">
      <Link className="commerce-back" href={pathFor(locale, "destinations")}>
        <ArrowLeft size={16} />
        {es ? "Seguir explorando" : "Keep exploring"}
      </Link>
      <header className="commerce-checkout-heading">
        <p className="eyebrow">MYTRIPSIM / {es ? "TU VIAJE" : "YOUR TRIP"}</p>
        <h1>
          {es ? "Tu conexión, a un paso." : "Your connection, one step away."}
        </h1>
        <p>
          {es
            ? "Revisa tus eSIM y el correo donde recibirás las instrucciones."
            : "Review your eSIMs and the email where you’ll receive your instructions."}
        </p>
      </header>
      {!count ? (
        <section className="commerce-card">
          <CartItems locale={locale} />
        </section>
      ) : (
        <div className="commerce-checkout-grid">
          <section className="commerce-checkout-main">
            {!email && !activePayment && (
              <div className="checkout-account-offer">
                <span className="commerce-badge">
                  <UserRound size={22} />
                </span>
                <div>
                  <h2>{es ? "A tu manera" : "Your trip, your way"}</h2>
                  <p>
                    {es
                      ? "Continúa como invitado o entra para tener tus eSIM siempre a mano."
                      : "Continue as a guest or sign in to keep your eSIMs in one place."}
                  </p>
                  <div>
                    <Link href={`${authPath(locale, "login")}?next=${next}`}>
                      {es ? "Iniciar sesión" : "Sign in"}
                      <ArrowRight size={14} />
                    </Link>
                    <Link href={`${authPath(locale, "register")}?next=${next}`}>
                      {es ? "Crear una cuenta" : "Create an account"}
                    </Link>
                  </div>
                </div>
              </div>
            )}
            {activePayment ? (
              <EmbeddedPayment
                orderId={activePayment.orderId}
                key={activePayment.orderId}
                clientSecret={activePayment.clientSecret}
                publishableKey={publishableKey}
                total={activePayment.total}
                locale={locale}
                buyer={activePayment.buyer}
                recipient={activePayment.recipient}
                onBack={() => {
                  setPayment(null);
                  setError("");
                }}
              />
            ) : (
              <form className="commerce-card checkout-form" onSubmit={pay}>
                <header>
                  <span className="commerce-badge">
                    <Mail size={22} />
                  </span>
                  <div>
                    <h2>{es ? "Datos de tu pedido" : "Your order details"}</h2>
                    <p>
                      {es
                        ? "Solo necesitamos tu correo. No hace falta una cuenta."
                        : "Your email is all we need. No account required."}
                    </p>
                  </div>
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
                      ? "Estás usando el correo verificado de tu cuenta."
                      : "You’re using your account’s verified email."
                    : es
                      ? "Comprueba que esté bien escrito: recibirás aquí el QR y la guía después del pago."
                      : "Double-check the spelling: your QR and guide will arrive here after payment."}
                </p>
                {email && (
                  <Link
                    href={experiencePath(locale, "wallet")}
                    className="checkout-session"
                  >
                    <BadgeCheck size={16} />
                    {es
                      ? "Sesión iniciada · Ir a Mis eSIM"
                      : "Signed in · Go to My eSIMs"}
                  </Link>
                )}
                <label className="commerce-checkbox checkout-marketing">
                  <input
                    type="checkbox"
                    name="marketingOptIn"
                    checked={marketingOptIn}
                    onChange={(event) =>
                      setMarketingOptIn(event.target.checked)
                    }
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
                  aria-labelledby="checkout-beneficiary-title"
                >
                  <h2 id="checkout-beneficiary-title">
                    <Gift size={19} />
                    {es ? "Beneficiario" : "Recipient"}
                  </h2>
                  <p className="commerce-muted">
                    {es
                      ? "Las instrucciones de la eSIM se enviarán a"
                      : "The eSIM instructions will be sent to"}{" "}
                    <strong>
                      {differentRecipient
                        ? recipientEmail ||
                          (es
                            ? "el correo del beneficiario"
                            : "the recipient’s email")
                        : buyerEmail ||
                          (es ? "tu correo electrónico" : "your email address")}
                    </strong>
                    .
                  </p>
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
                        ? "Enviar la eSIM a un correo electrónico diferente"
                        : "Send the eSIM to a different email address"}
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
                <div className="checkout-payment">
                  <span className="commerce-badge">
                    <CreditCard size={22} />
                  </span>
                  <div>
                    <h2>{es ? "Pago seguro" : "Secure payment"}</h2>
                    <p>
                      {es
                        ? enabled
                          ? "En el siguiente paso introduces tu tarjeta aquí mismo, con la protección de Stripe."
                          : "Revisa tu correo y los detalles de tu pedido antes de continuar al pago."
                        : enabled
                          ? "Enter your card in the next step, right here, protected by Stripe."
                          : "Review your email and order details before continuing to payment."}
                    </p>
                    <span className="checkout-pending">
                      <LockKeyhole size={14} />
                      {es
                        ? enabled
                          ? testMode
                            ? "Modo de pruebas · sin cargos reales"
                            : "Pago protegido por Stripe"
                          : "Conectando con el pago seguro"
                        : enabled
                          ? testMode
                            ? "Test mode · no real charges"
                            : "Payment protected by Stripe"
                          : "Connecting to secure payment"}
                    </span>
                  </div>
                </div>
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
                    cart.loading ||
                    cart.error ||
                    total == null ||
                    !compatible ||
                    !terms
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
                    : enabled
                      ? es
                        ? testMode
                          ? "Continuar al pago de prueba"
                          : "Continuar al pago"
                        : testMode
                          ? "Continue to test payment"
                          : "Continue to payment"
                      : es
                        ? "Continuar al pago"
                        : "Continue to payment"}
                </button>
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
            )}
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
            <CartItems locale={locale} />
            <div className="checkout-total">
              <span>{es ? "Total" : "Total"}</span>
              <strong>
                {!cart.loading &&
                !cart.error &&
                cartTotal(cart.resolved) != null
                  ? formatUSD(cartTotal(cart.resolved)!, locale)
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
