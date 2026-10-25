"use client";
import { useMemo, useRef, useEffect, useState, type FormEvent } from "react";
import { loadStripe } from "@stripe/stripe-js";
import type { StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import {
  CheckoutElementsProvider,
  PaymentElement,
  ExpressCheckoutElement,
  useCheckoutElements,
} from "@stripe/react-stripe-js/checkout";
import {
  ArrowLeft,
  CreditCard,
  LockKeyhole,
  LoaderCircle,
  Mail,
} from "lucide-react";
import { formatUSD } from "@/lib/retail-prices";
import type { Locale } from "@/lib/i18n";
import {
  expressWalletOptions,
  hasExpressWallet,
} from "@/lib/payments/wallet-options";

export function EmbeddedPayment({
  clientSecret,
  publishableKey,
  total,
  locale,
  buyer,
  recipient,
  onBack,
}: {
  clientSecret: string;
  publishableKey: string;
  total: number;
  locale: Locale;
  buyer: string;
  recipient: string;
  onBack: () => void;
}) {
  const stripe = useMemo(
    () => loadStripe(publishableKey, { locale }),
    [publishableKey, locale],
  );
  const options = useMemo(
    () => ({
      clientSecret,
      elementsOptions: {
        appearance: {
          theme: "stripe" as const,
          variables: {
            colorPrimary: "#126de8",
            colorBackground: "#ffffff",
            colorText: "#0f172a",
            colorDanger: "#a53522",
            fontFamily: "Inter, system-ui, sans-serif",
            fontSizeBase: "16px",
            borderRadius: "12px",
            spacingUnit: "4px",
          },
          rules: {
            ".Input": {
              border: "1px solid #c8daf3",
              boxShadow: "none",
              padding: "14px",
              fontStyle: "normal",
            },
            ".Input:focus": {
              border: "1px solid #1677ff",
              boxShadow: "0 0 0 3px #edf5ff",
            },
            ".Label": {
              fontWeight: "600",
              fontSize: "13px",
              fontStyle: "normal",
            },
            ".Tab": { border: "1px solid #dce7f5", boxShadow: "none" },
          },
        },
      },
    }),
    [clientSecret],
  );
  return (
    <section
      className="commerce-card embedded-payment-card"
      aria-labelledby="embedded-payment-title"
    >
      <CheckoutElementsProvider stripe={stripe} options={options}>
        <PaymentForm
          locale={locale}
          total={total}
          buyer={buyer}
          recipient={recipient}
          onBack={onBack}
        />
      </CheckoutElementsProvider>
    </section>
  );
}
function PaymentForm({
  locale,
  total,
  buyer,
  recipient,
  onBack,
}: {
  locale: Locale;
  total: number;
  buyer: string;
  recipient: string;
  onBack: () => void;
}) {
  const es = locale === "es";
  const state = useCheckoutElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [walletsAvailable, setWalletsAvailable] = useState(false);
  const submitting = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await confirmPayment();
  }
  async function confirmPayment(
    expressEvent?: StripeExpressCheckoutElementConfirmEvent,
  ) {
    if (
      state.type !== "success" ||
      submitting.current ||
      (!expressEvent && !ready)
    ) {
      expressEvent?.paymentFailed({ reason: "fail" });
      return;
    }
    submitting.current = true;
    setBusy(true);
    setError("");
    try {
      if (state.checkout.livemode) throw new Error("Live payments disabled");
      const result = await state.checkout.confirm(
        expressEvent
          ? { expressCheckoutConfirmEvent: expressEvent }
          : undefined,
      );
      if (result.type === "error") setError(result.error.message);
    } catch {
      expressEvent?.paymentFailed({ reason: "fail" });
      setError(
        es
          ? "No pudimos confirmar el pago. Revisa tu conexión y vuelve a intentarlo."
          : "We couldn’t confirm payment. Check your connection and try again.",
      );
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  return (
    <>
      <header className="embedded-payment-heading">
        <span className="commerce-badge">
          <CreditCard size={22} />
        </span>
        <div>
          <h2 id="embedded-payment-title" ref={heading} tabIndex={-1}>
            {es ? "Detalles del pago" : "Payment details"}
          </h2>
          <p>
            {es
              ? "Pago seguro con Stripe, sin salir de MyTripSim."
              : "Secure payment with Stripe, right here on MyTripSim."}
          </p>
        </div>
      </header>
      <div className="embedded-payment-contact">
        <Mail size={18} />
        <dl>
          <div>
            <dt>{es ? "Correo del comprador" : "Buyer email"}</dt>
            <dd>{buyer}</dd>
          </div>
          <div>
            <dt>{es ? "Enviar la eSIM a" : "Send the eSIM to"}</dt>
            <dd>{recipient}</dd>
          </div>
        </dl>
      </div>
      <form onSubmit={pay}>
        {state.type === "error" ? (
          <p className="checkout-error" role="alert">
            {es
              ? "No pudimos cargar el formulario de Stripe. Vuelve a tus datos e inténtalo de nuevo."
              : "We couldn’t load the Stripe form. Return to your details and try again."}
          </p>
        ) : (
          <>
            <div
              className="checkout-express"
              data-visible={walletsAvailable}
              aria-hidden={!walletsAvailable}
            >
              <h3>{es ? "Pago exprés" : "Express payment"}</h3>
              <ExpressCheckoutElement
                options={expressWalletOptions}
                onReady={(event) =>
                  setWalletsAvailable(
                    hasExpressWallet(event.availablePaymentMethods),
                  )
                }
                onAvailablePaymentMethodsChange={(event) =>
                  setWalletsAvailable(hasExpressWallet(event.paymentMethods))
                }
                onLoadError={() => setWalletsAvailable(false)}
                onConfirm={(event) => {
                  void confirmPayment(event);
                }}
              />
              <div className="checkout-payment-divider">
                <span>{es ? "o paga con tarjeta" : "or pay by card"}</span>
              </div>
            </div>
            {(!ready || state.type === "loading") && (
              <p className="commerce-muted" role="status">
                <LoaderCircle size={16} className="payment-spinner" />{" "}
                {es ? "Cargando formulario seguro…" : "Loading secure form…"}
              </p>
            )}
            <PaymentElement
              options={{
                layout: "tabs",
                paymentMethodOrder: ["card"],
                wallets: {
                  applePay: "never",
                  googlePay: "never",
                  link: "never",
                },
              }}
              onReady={() => setReady(true)}
              onLoadError={() =>
                setError(
                  es
                    ? "El formulario no se ha cargado. Revisa tu conexión o vuelve a tus datos."
                    : "The form didn’t load. Check your connection or return to your details.",
                )
              }
            />
          </>
        )}
        {error && (
          <p className="checkout-error" role="alert">
            {error}
          </p>
        )}
        <p className="embedded-payment-secure">
          <LockKeyhole size={15} />
          {es
            ? "Tus datos de tarjeta se envían directamente a Stripe."
            : "Your card details go directly to Stripe."}
        </p>
        <button
          className="button button-primary checkout-pay"
          type="submit"
          disabled={busy || !ready || state.type !== "success"}
        >
          {busy ? (
            <LoaderCircle className="payment-spinner" size={17} />
          ) : (
            <LockKeyhole size={17} />
          )}
          {busy
            ? es
              ? "Confirmando pago…"
              : "Confirming payment…"
            : `${es ? "Pagar" : "Pay"} ${formatUSD(total, locale)} · ${es ? "prueba" : "test"}`}
        </button>
        <p className="commerce-muted">
          {es
            ? "Modo de pruebas. No se harán cargos ni se emitirán eSIM reales."
            : "Test mode. No real charges or eSIMs will be issued."}
        </p>
      </form>
      <button
        type="button"
        className="embedded-payment-back"
        onClick={onBack}
        disabled={busy}
      >
        <ArrowLeft size={16} />
        {es ? "Editar datos del pedido" : "Edit order details"}
      </button>
    </>
  );
}
