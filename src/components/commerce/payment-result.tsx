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

const receiptSchema = z.object({
  id: z.uuid(),
  status: z.enum(["pending", "paid", "expired", "failed"]),
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
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    async function check() {
      setError(false);
      setWaiting(true);
      try {
        const response = await fetch(`/api/checkout/status?order=${orderId}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Receipt unavailable");
        const data = receiptSchema.parse(await response.json());
        if (controller.signal.aborted) return;
        setReceipt(data);
        if (data.status === "pending" && !cancelled && ++attempts < 20) {
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
  const stopped =
    receipt?.status === "failed" ||
    receipt?.status === "expired" ||
    (cancelled && !paid);
  const Icon = paid ? CheckCircle2 : stopped ? CircleX : Clock3;
  const title = paid
    ? es
      ? "Pago de prueba confirmado"
      : "Test payment confirmed"
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
        <span className="payment-result-icon">
          <Icon size={36} aria-hidden="true" />
        </span>
        <p className="eyebrow">MYTRIPSIM / {es ? "TU PEDIDO" : "YOUR ORDER"}</p>
        <h1 id="payment-result-title">{title}</h1>
        <p role="status" aria-live="polite">
          {paid
            ? es
              ? "El pago está registrado. Esta compra es de prueba: no se han hecho cargos ni emitido eSIM reales."
              : "Your payment is recorded. This is a test purchase: no real charges or eSIMs were issued."
            : stopped
              ? es
                ? "Puedes volver a tu carrito y continuar cuando quieras. Tus planes siguen guardados."
                : "You can return to your cart and continue when you’re ready. Your plans are saved."
              : es
                ? "Esperamos la confirmación del pago. No necesitas volver a pagar."
                : "We’re waiting for payment confirmation. You don’t need to pay again."}
        </p>
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
        {!paid && (
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
          {paid ? (
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
        <p className="payment-result-note">
          <ShieldCheck size={16} />
          {es
            ? "Modo de pruebas · Sin cargos reales"
            : "Test mode · No real charges"}
        </p>
      </section>
    </div>
  );
}
