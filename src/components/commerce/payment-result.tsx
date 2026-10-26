"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Clock3,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  ShieldCheck,
  CircleX,
} from "lucide-react";
import { z } from "zod";
import { useCart } from "./cart-provider";
import { pathFor, type Locale } from "@/lib/i18n";
import { experiencePath } from "@/lib/experience-routes";
import { formatUSD } from "@/lib/retail-prices";
import { planVariant } from "@/lib/plan-variants";
import { authPath } from "@/lib/auth-routes";
import { SimMascot } from "@/components/sim-mascot";
import { EmbeddedPayment } from "./embedded-payment";
import { EsimDelivery } from "./esim-delivery";
import { HoldCountdown, forgetPayment, markPaymentLeave } from "./payment-hold";

const receiptSchema = z.object({
  id: z.uuid(),
  status: z.enum(["pending", "paid", "expired", "failed", "cancelled"]),
  holdExpiresAt: z.string().nullable().optional(),
  paymentInProgress: z.boolean().optional(),
  serverTime: z.string().optional(),
  total: z.number().int().positive(),
  currency: z.literal("usd"),
  test: z.boolean(),
  items: z.array(
    z.object({
      plan_id: z.string(),
      destination_slug: z.string(),
      destination_name: z.object({ es: z.string(), en: z.string() }),
      plan_name: z.string(),
      data_gb: z.coerce.number().positive(),
      days: z.number().int().positive(),
      quantity: z.number().int().positive(),
      unit_amount: z.number().int().positive(),
    }),
  ),
});
export function PaymentResult({
  locale,
  orderId,
  cancelled,
}: {
  locale: Locale;
  orderId: string;
  cancelled: boolean;
}) {
  const es = locale === "es";
  const cart = useCart();
  const consumed = useRef(false);
  const [receipt, setReceipt] = useState<z.infer<typeof receiptSchema> | null>(
    null,
  );
  const [error, setError] = useState(false);
  const [waiting, setWaiting] = useState(true);
  const [retry, setRetry] = useState(0);
  const [elapsed, setElapsed] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [payment, setPayment] = useState<{
    clientSecret: string;
    publishableKey: string;
    total: number;
    buyer: string;
    recipient: string;
  } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    async function check() {
      setError(false);
      setWaiting(true);
      try {
        const response = await fetch(
          `/api/checkout/status?order=${orderId}${attempts === 0 ? "&inspect=1" : ""}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new Error("Receipt unavailable");
        const data = receiptSchema.parse(await response.json());
        if (controller.signal.aborted) return;
        setReceipt(data);
        if (data.status !== "pending") forgetPayment(orderId);
        if (
          data.status === "pending" &&
          (!cancelled || data.serverTime) &&
          ++attempts < (data.holdExpiresAt ? 120 : 20)
        ) {
          timer = setTimeout(check, 3000);
          return;
        }
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
      if (!controller.signal.aborted) setWaiting(false);
    }
    void check();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [orderId, cancelled, retry]);
  useEffect(() => {
    if (receipt?.status !== "paid" || consumed.current) return;
    consumed.current = true;
    cart.complete(
      orderId,
      receipt.items.map((item) => ({
        destination: item.destination_slug,
        planId: item.plan_id,
        quantity: item.quantity,
      })),
    );
  }, [receipt, orderId, cart]);
  const paid = receipt?.status === "paid";
  const holding =
    receipt?.status === "pending" &&
    !receipt.paymentInProgress &&
    !!receipt.holdExpiresAt;
  const expired = receipt?.status === "cancelled";
  const stopped =
    receipt?.status === "failed" ||
    receipt?.status === "expired" ||
    expired ||
    (cancelled && !paid && !holding && !receipt?.paymentInProgress);
  const Icon = paid ? CheckCircle2 : stopped ? CircleX : Clock3;
  async function resume() {
    setResuming(true);
    setError(false);
    try {
      const response = await fetch("/api/checkout/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (!response.ok) throw new Error("Resume failed");
      const data = await response.json();
      if (
        data.status !== "pending" ||
        data.paymentInProgress ||
        !data.clientSecret
      ) {
        setRetry((value) => value + 1);
        return;
      }
      setPayment({
        clientSecret: data.clientSecret,
        publishableKey: data.publishableKey,
        total: data.total,
        buyer: data.buyer,
        recipient: data.recipient,
      });
    } catch {
      setError(true);
    } finally {
      setResuming(false);
    }
  }
  if (payment && receipt?.status === "pending" && !elapsed)
    return (
      <div className="container payment-result-wrap payment-resume-wrap">
        <header className="payment-resume-heading">
          <SimMascot variant="paymentHold" locale={locale} sizes="160px" />
          <div>
            <p className="eyebrow">MYTRIPSIM</p>
            <h1>{es ? "Completar el pago" : "Complete payment"}</h1>
            <p>
              {es
                ? "Tu pedido sigue aquí. Termina el pago antes de que acabe el tiempo."
                : "Your order is still here. Finish payment before time runs out."}
            </p>
          </div>
        </header>
        <EmbeddedPayment
          orderId={orderId}
          locale={locale}
          {...payment}
          onBack={() => {
            markPaymentLeave(orderId);
            setPayment(null);
            setRetry((value) => value + 1);
          }}
        />
      </div>
    );
  const title = expired
    ? es
      ? "Pedido cancelado"
      : "Order cancelled"
    : holding
      ? es
        ? "Completar el pago"
        : "Complete payment"
      : paid
        ? es
          ? receipt.test
            ? "Pago de prueba confirmado"
            : "Pago confirmado"
          : receipt.test
            ? "Test payment confirmed"
            : "Payment confirmed"
        : stopped
          ? es
            ? "Tu pago no se ha completado"
            : "Your payment isn’t complete"
          : es
            ? "Estamos comprobando tu pago"
            : "We’re checking your payment";
  return (
    <div className="container payment-result-wrap">
      <section
        className={`commerce-card payment-result ${paid ? "payment-result-paid" : ""}`}
        aria-labelledby="payment-result-title"
      >
        {holding ? (
          <SimMascot
            variant="paymentHold"
            locale={locale}
            className="payment-hold-mascot"
            sizes="(max-width:650px) 170px, 220px"
            eager
          />
        ) : (
          <span className="payment-result-icon">
            <Icon size={36} aria-hidden="true" />
          </span>
        )}
        <p className="eyebrow">MYTRIPSIM / {es ? "TU PEDIDO" : "YOUR ORDER"}</p>
        <h1 id="payment-result-title">
          {error && !receipt
            ? es
              ? "No podemos mostrar este pedido"
              : "We can’t display this order"
            : title}
        </h1>
        <p role="status" aria-live="polite">
          {expired
            ? es
              ? "El plazo de cinco minutos terminó y este pedido ya no admite pagos. Tus planes siguen en el carrito si quieres empezar de nuevo."
              : "The five-minute window ended and this order no longer accepts payment. Your plans are still in the cart if you want to start again."
            : holding
              ? es
                ? "Te guardamos el pedido durante cinco minutos desde que saliste del pago. Puedes retomarlo con el tiempo que queda."
                : "We’ll keep your order for five minutes after you leave payment. You can resume with the remaining time."
              : paid
                ? es
                  ? receipt.test
                    ? "El pago de prueba está registrado, sin cargos reales. Puedes consultar el estado de tus eSIM debajo."
                    : "Tu pago está confirmado. Puedes consultar el estado de tus eSIM y las instrucciones de entrega debajo."
                  : receipt.test
                    ? "Your test payment is recorded, with no real charges. Check your eSIM delivery status below."
                    : "Your payment is confirmed. Check your eSIM preparation and delivery status below."
                : stopped
                  ? es
                    ? "Puedes volver a tu carrito y continuar cuando quieras. Tus planes siguen guardados."
                    : "You can return to your cart and continue when you’re ready. Your plans are saved."
                  : es
                    ? "Esperamos la confirmación del pago. No necesitas volver a pagar."
                    : "We’re waiting for payment confirmation. You don’t need to pay again."}
        </p>
        {holding && (
          <HoldCountdown
            deadline={receipt.holdExpiresAt!}
            serverTime={receipt.serverTime ?? new Date().toISOString()}
            locale={locale}
            onElapsed={() => {
              setElapsed(true);
              setPayment(null);
              setRetry((value) => value + 1);
            }}
          />
        )}
        {receipt && (
          <div className="payment-receipt">
            <div className="payment-receipt-heading">
              <strong>{es ? "Resumen" : "Summary"}</strong>
              <span>#{receipt.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <ul>
              {receipt.items.map((item) => (
                <li key={item.plan_id}>
                  <div>
                    <strong>{item.destination_name[locale]}</strong>
                    <span>
                      {item.data_gb} GB · {item.days} {es ? "días" : "days"} ·{" "}
                      {
                        planVariant(
                          { id: item.plan_id, name: item.plan_name },
                          locale,
                        ).label
                      }
                    </span>
                    <small>
                      {es ? "Cantidad" : "Quantity"}: {item.quantity}
                    </small>
                  </div>
                  <strong>
                    {formatUSD(item.unit_amount * item.quantity, locale)}
                  </strong>
                </li>
              ))}
            </ul>
            <div className="payment-receipt-total">
              <strong>Total</strong>
              <strong>{formatUSD(receipt.total, locale)}</strong>
            </div>
          </div>
        )}
        {error && (
          <p className="checkout-error" role="alert">
            {es
              ? "No pudimos consultar el estado. Abre esta página en el navegador donde empezaste la compra o inicia sesión con tu cuenta y vuelve a intentarlo."
              : "We couldn’t check the status. Open this page in the browser where you started your purchase, or sign in to your account and try again."}
          </p>
        )}
        {!paid && !holding && !expired && (
          <button
            className="button button-secondary"
            onClick={() => setRetry((value) => value + 1)}
            disabled={waiting}
          >
            <RefreshCw size={16} className={waiting ? "payment-spinner" : ""} />
            {waiting
              ? es
                ? "Comprobando…"
                : "Checking…"
              : es
                ? "Comprobar estado"
                : "Check status"}
          </button>
        )}
        <div className="payment-result-actions">
          {error && (
            <Link
              href={`${authPath(locale, "login")}?next=${encodeURIComponent(`/${locale}/checkout/result?order=${orderId}`)}`}
            >
              {es ? "Iniciar sesión" : "Sign in"}
            </Link>
          )}
          {holding ? (
            <button
              type="button"
              className="button button-primary"
              onClick={resume}
              disabled={elapsed || resuming}
            >
              {resuming
                ? es
                  ? "Preparando tu pago…"
                  : "Preparing payment…"
                : es
                  ? "Completar el pago"
                  : "Complete payment"}
              <ArrowRight size={17} />
            </button>
          ) : paid ? (
            <Link
              className="button button-primary"
              href={experiencePath(locale, "wallet")}
            >
              {es ? "Ir a Mis eSIM" : "Go to My eSIMs"}
              <ArrowRight size={17} />
            </Link>
          ) : (
            <Link
              className="button button-primary"
              href={experiencePath(locale, "checkout")}
            >
              <ArrowLeft size={17} />
              {es ? "Volver a mi carrito" : "Back to my cart"}
            </Link>
          )}
          <Link href={pathFor(locale, "destinations")}>
            {es ? "Explorar destinos" : "Explore destinations"}
          </Link>
        </div>
        {receipt?.test && (
          <p className="payment-result-note">
            <ShieldCheck size={16} />
            {es
              ? "Modo de pruebas · Sin cargos reales"
              : "Test mode · No real charges"}
          </p>
        )}
      </section>
      {paid && <EsimDelivery locale={locale} orderId={orderId} />}
    </div>
  );
}
