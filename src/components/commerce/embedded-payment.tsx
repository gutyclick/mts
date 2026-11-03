"use client";
import { useMemo, useRef, useEffect, useState, type FormEvent } from "react";
import { loadStripe } from "@stripe/stripe-js";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { paymentFeedback } from "@/lib/payments/payment-feedback";
import { recordCheckoutStats } from "@/lib/analytics/client";
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
import { formatMoney, type Currency } from "@/lib/currency";
import { useCurrency } from "@/components/currency-provider";
import type { Locale } from "@/lib/i18n";
import { HoldCountdown, usePaymentPresence } from "./payment-hold";
import {
  expressWalletOptions,
  hasExpressWallet,
} from "@/lib/payments/wallet-options";

export function EmbeddedPayment({
  clientSecret,
  publishableKey,
  total,
  currency = "USD",
  locale,
  buyer,
  recipient,
  onBack,
  orderId,
}: {
  clientSecret: string;
  publishableKey: string;
  total: number;
  currency?: Currency;
  locale: Locale;
  buyer: string;
  recipient: string;
  onBack: () => void;
  orderId: string;
}) {
  const root = useRef<HTMLElement>(null);
  const presence = usePaymentPresence(orderId, root);
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
      ref={root}
      className="commerce-card embedded-payment-card"
      aria-labelledby="embedded-payment-title"
    >
      {presence.state?.holdExpiresAt && (
        <HoldCountdown
          deadline={presence.state.holdExpiresAt}
          serverTime={presence.state.serverTime}
          locale={locale}
        />
      )}
      {presence.elapsed ? (
        <p role="status">
          {locale === "es"
            ? "El plazo ha terminado. Estamos comprobando el estado de tu pedido…"
            : "The time is up. We’re checking your order status…"}
        </p>
      ) : (
        <CheckoutElementsProvider stripe={stripe} options={options}>
          <PaymentForm
            locale={locale}
            live={publishableKey.startsWith("pk_live_")}
            total={total}
            currency={currency}
            buyer={buyer}
            recipient={recipient}
            onBack={onBack}
            orderId={orderId}
          />
        </CheckoutElementsProvider>
      )}
    </section>
  );
}
function PaymentForm({
  live,
  locale,
  total,
  currency,
  buyer,
  recipient,
  onBack,
  orderId,
}: {
  live: boolean;
  locale: Locale;
  total: number;
  currency: Currency;
  buyer: string;
  recipient: string;
  onBack: () => void;
  orderId: string;
}) {
  const router = useRouter();
  const { setPaymentBusy } = useCurrency();
  useEffect(() => () => setPaymentBusy(false), [setPaymentBusy]);
  const es = locale === "es";
  const state = useCheckoutElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [walletsAvailable, setWalletsAvailable] = useState(false);
  const submitting = useRef(false);
  const [verifyOrder, setVerifyOrder] = useState(false);
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
      verifyOrder ||
      (!expressEvent && !ready)
    ) {
      expressEvent?.paymentFailed({ reason: "fail" });
      return;
    }
    submitting.current = true;
    setPaymentBusy(true);
    setBusy(true);
    setError("");
    let confirmationStarted = false;
    recordCheckoutStats("payment_attempt");
    try {
      if (
        state.checkout.livemode !== live ||
        state.checkout.currency.toUpperCase() !== currency ||
        state.checkout.total.total.minorUnitsAmount !== total
      )
        throw new Error("Payment environment mismatch");
      confirmationStarted = true;
      const result = await state.checkout.confirm(
        expressEvent
          ? { expressCheckoutConfirmEvent: expressEvent }
          : undefined,
      );
      if (result.type === "error") {
        recordCheckoutStats("payment_error");
        const guidance = paymentFeedback(result.error, locale, {
          confirmationStarted: true,
        });
        setError(guidance.message);
        if (guidance.action === "verify") setVerifyOrder(true);
      } else {
        router.push(
          `/${locale}/checkout/result?order=${encodeURIComponent(orderId)}`,
        );
      }
    } catch (error) {
      expressEvent?.paymentFailed({ reason: "fail" });
      recordCheckoutStats("payment_error");
      const guidance = paymentFeedback(error, locale, { confirmationStarted });
      setError(guidance.message);
      if (guidance.action === "verify") setVerifyOrder(true);
    } finally {
      submitting.current = false;
      setPaymentBusy(false);
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
                <span>
                  {es ? "u otro método de pago" : "or another payment method"}
                </span>
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
        {verifyOrder && (
          <Link
            className="button button-secondary"
            href={`/${locale}/checkout/result?order=${encodeURIComponent(orderId)}`}
          >
            {es ? "Comprobar estado del pedido" : "Check order status"}
          </Link>
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
          disabled={
            busy ||
            verifyOrder ||
            !ready ||
            state.type !== "success" ||
            (state.type === "success" &&
              (state.checkout.currency.toUpperCase() !== currency ||
                state.checkout.total.total.minorUnitsAmount !== total))
          }
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
            : `${es ? "Pagar" : "Pay"} ${formatMoney(total, currency, locale)}${live ? "" : ` · ${es ? "prueba" : "test"}`}`}
        </button>
        {!live && (
          <p className="commerce-muted">
            {es
              ? "Modo de pruebas. No se harán cargos ni se emitirán eSIM reales."
              : "Test mode. No real charges or eSIMs will be issued."}
          </p>
        )}
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
