"use client";
import { useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  CircleHelp,
  CreditCard,
  LockKeyhole,
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
  useEffect(() => {
    if (!initial || initialized.current) return;
    initialized.current = true;
    cart.ensure(initial);
  }, [initial, cart]);
  const count = cart.lines.reduce((sum, item) => sum + item.quantity, 0);
  const next = encodeURIComponent(experiencePath(locale, "checkout"));
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
            <form
              className="commerce-card checkout-form"
              onSubmit={(event) => event.preventDefault()}
            >
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
                      ? "Tu precio final ya está disponible. Estamos preparando las opciones de pago para completar tu compra."
                      : "Your final price is now available. We’re preparing payment options so you can complete your purchase."}
                  </p>
                  <span className="checkout-pending">
                    <LockKeyhole size={14} />
                    {es
                      ? "El pago aún no está habilitado"
                      : "Payment is not available yet"}
                  </span>
                </div>
              </div>
              <label className="commerce-checkbox">
                <input type="checkbox" name="compatible" required />
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
                <input type="checkbox" name="terms" required />
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
                disabled
                aria-describedby="checkout-payment-note"
              >
                <LockKeyhole size={17} />
                {es ? "Continuar al pago" : "Continue to payment"}
              </button>
              <p id="checkout-payment-note" className="commerce-muted">
                {es
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
