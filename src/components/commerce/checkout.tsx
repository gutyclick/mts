"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
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
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { pathFor } from "@/lib/i18n";
import { authPath } from "@/lib/auth-routes";
import { experiencePath } from "@/lib/experience-routes";
import type { CartLine } from "@/lib/cart";
import { cartTotal } from "@/lib/cart";
import { formatUSD } from "@/lib/retail-prices";
import { CartItems, useCart } from "./cart-provider";

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
  const [enabled, setEnabled] = useState(false);
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
        if (response.ok) setEnabled((await response.json()).enabled === true);
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
    const recipient = String(
      new FormData(event.currentTarget).get("email") ?? "",
    ).trim();
    const key = JSON.stringify([cart.lines, recipient, total, locale]);
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
          email: recipient,
          lines: cart.lines,
          expectedTotal: total,
          compatible: true,
          terms: true,
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
      const url = new URL(data.url);
      if (
        url.origin !== window.location.origin &&
        (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com")
      )
        throw new Error("Invalid redirect");
      window.location.assign(url.href);
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
            {!email && (
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
            <form className="commerce-card checkout-form" onSubmit={pay}>
              <header>
                <span className="commerce-badge">
                  <Mail size={22} />
                </span>
                <div>
                  <h2>
                    {es
                      ? "¿Dónde te enviamos tu eSIM?"
                      : "Where should we send your eSIM?"}
                  </h2>
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
                    defaultValue={email ?? ""}
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
              <div className="checkout-payment">
                <span className="commerce-badge">
                  <CreditCard size={22} />
                </span>
                <div>
                  <h2>{es ? "Pago seguro" : "Secure payment"}</h2>
                  <p>
                    {es
                      ? enabled
                        ? "Continúa a Stripe para completar el pago de prueba de forma segura."
                        : "Tu precio final ya está disponible. Estamos preparando las opciones de pago para completar tu compra."
                      : enabled
                        ? "Continue to Stripe to complete a secure test payment."
                        : "Your final price is now available. We’re preparing payment options so you can complete your purchase."}
                  </p>
                  <span className="checkout-pending">
                    <LockKeyhole size={14} />
                    {es
                      ? enabled
                        ? "Modo de pruebas · sin cargos reales"
                        : "El pago aún no está habilitado"
                      : enabled
                        ? "Test mode · no real charges"
                        : "Payment is not available yet"}
                  </span>
                </div>
              </div>
              <label className="commerce-checkbox">
                <input
                  type="checkbox"
                  name="compatible"
                  required
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
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                />
                <span>
                  {es ? "He leído los" : "I have read the"}{" "}
                  <Link href={pathFor(locale, "terms")}>
                    {es ? "términos" : "terms"}
                  </Link>{" "}
                  {es ? "y la" : "and"}{" "}
                  <Link href={pathFor(locale, "refunds")}>
                    {es ? "política de reembolsos" : "refund policy"}
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
                      ? "Continuar al pago de prueba"
                      : "Continue to test payment"
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
                {enabled
                  ? es
                    ? "Esta compra es de prueba: no se harán cargos ni se enviarán QR de eSIM reales."
                    : "This is a test purchase: no real charges or eSIM QR codes will be sent."
                  : es
                    ? "No se realizará ningún cargo mientras el pago siga desactivado."
                    : "You won’t be charged while payment remains disabled."}
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
