"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { PortalTrip } from "@/lib/portal/model";
import type { Locale } from "@/lib/i18n";
import { usePortal } from "./portal-state";
import { businessMessage } from "./portal-business-copy";
import { YappyPayment } from "./yappy-payment";
import "@/styles/business-commerce.css";

type CommerceOrder = {
  id: string;
  state: string;
  plan_name: string;
  quantity: number;
  unit_cents: number;
  tax_cents: number;
  total_cents: number;
  quote_expires_at: string;
  paid_at: string | null;
  ready_units: number;
  issued_units: number;
  units: { id: string; status: string }[];
};
type CommerceSnapshot = {
  order: CommerceOrder | null;
  methods: { stripe: boolean; transfer: boolean; yappy: boolean };
  bankInstructions: string;
  yappyLive: boolean;
};
export function PortalCommerce({
  trip,
  locale,
  base,
}: {
  trip: PortalTrip;
  locale: Locale;
  base: string;
}) {
  const { company } = usePortal();
  const es = locale === "es",
    t = (a: string, b: string) => (es ? a : b);
  const [data, setData] = useState<CommerceSnapshot | null>(null);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const canPay = company.role === "owner" || company.role === "finance";
  const canDownload =
    company.role === "owner" || company.role === "coordinator";
  const money = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
    }).format(value / 100);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/portal/commerce?tripId=${encodeURIComponent(trip.id)}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok) throw Error(value.error ?? "unavailable");
        setData(value);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setError(businessMessage(error.message, locale));
      });
    return () => controller.abort();
  }, [trip.id, locale, revision]);
  async function pay(action: "stripe" | "transfer_notice", reference?: string) {
    if (!data?.order || busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/portal/commerce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          orderId: data.order.id,
          ...(reference ? { reference } : {}),
        }),
      });
      const value = await response.json();
      if (!response.ok) throw Error(value.error ?? "unavailable");
      if (action === "stripe") {
        const url = new URL(value.url);
        if (url.protocol !== "https:" || url.hostname !== "checkout.stripe.com")
          throw Error("unavailable");
        window.location.assign(url.href);
      } else {
        setNotice(
          t(
            "Referencia enviada. La administración verificará los fondos antes de autorizar la entrega.",
            "Reference sent. Administration will verify the funds before authorizing delivery.",
          ),
        );
        setRevision((value) => value + 1);
      }
    } catch (error) {
      setError(
        businessMessage(
          error instanceof Error ? error.message : "unavailable",
          locale,
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  function transfer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void pay(
      "transfer_notice",
      String(new FormData(event.currentTarget).get("reference") ?? "").trim(),
    );
  }
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const order = data?.order;
  const expired = order ? Date.parse(order.quote_expires_at) <= now : false;
  const payable =
    !!order && !order.paid_at && order.state === "awaiting_payment" && !expired;
  const labels: Record<string, string> = {
    awaiting_payment: t("Pendiente de pago", "Awaiting payment"),
    awaiting_release: t("Pago verificado", "Payment verified"),
    review: t(
      "El equipo está revisando el pedido",
      "Our team is reviewing the order",
    ),
    payment_pending: t("Verificando pago", "Verifying payment"),
    paid: t("Pago verificado", "Payment verified"),
    authorized: t("Entrega autorizada", "Delivery authorized"),
    provisioning: t("Preparando eSIM", "Preparing eSIMs"),
    ready: t("Listo para distribuir", "Ready to distribute"),
    failed: t("Requiere revisión", "Review needed"),
    expired: t("Cotización vencida", "Quote expired"),
  };
  return (
    <section
      className="bc-portal"
      aria-label={t("Pago y entrega", "Payment and delivery")}
      data-portal-base={base}
    >
      <header>
        <p className="bc-eyebrow">
          {t("Pago y entrega", "Payment and delivery")}
        </p>
        <h2>{t("Pedido de eSIM", "eSIM order")}</h2>
        <p>
          {t(
            "Tu cotización, pago y archivos en un solo lugar.",
            "Your quote, payment and files in one place.",
          )}
        </p>
      </header>
      {error && (
        <p className="bc-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="bc-notice" role="status">
          {notice}
        </p>
      )}
      {!data ? (
        <p role="status">{t("Cargando pedido…", "Loading order…")}</p>
      ) : !order ? (
        <p>
          {t(
            "La cotización aparecerá aquí cuando la administración la publique.",
            "Your quote will appear here when administration publishes it.",
          )}
        </p>
      ) : (
        <>
          <article className="bc-card">
            <div className="bc-order-heading">
              <h3>{order.plan_name}</h3>
              <span className="bc-badge">
                {labels[order.state] ?? t("En revisión", "Under review")}
              </span>
            </div>
            <dl className="bc-totals">
              <div>
                <dt>{t("Cantidad", "Quantity")}</dt>
                <dd>{order.quantity}</dd>
              </div>
              <div>
                <dt>{t("Precio unitario", "Unit price")}</dt>
                <dd>{money(order.unit_cents)}</dd>
              </div>
              <div>
                <dt>{t("Impuestos", "Taxes")}</dt>
                <dd>{money(order.tax_cents)}</dd>
              </div>
              <div>
                <dt>Total USD</dt>
                <dd>
                  <strong>{money(order.total_cents)}</strong>
                </dd>
              </div>
            </dl>
            {!order.paid_at && (
              <p>
                {expired
                  ? t(
                      "Cotización vencida. Solicita una nueva revisión.",
                      "Quote expired. Request a new review.",
                    )
                  : `${t("Válida hasta", "Valid until")}: ${new Date(order.quote_expires_at).toLocaleString(locale)}`}
              </p>
            )}
            {payable && canPay && (
              <fieldset disabled={busy} className="bc-content">
                <div className="bc-actions">
                  {data.methods.stripe && (
                    <button type="button" onClick={() => void pay("stripe")}>
                      {t("Pagar con Stripe", "Pay with Stripe")}
                    </button>
                  )}
                </div>
                {data.methods.yappy && (
                  <YappyPayment
                    orderId={order.id}
                    live={data.yappyLive}
                    locale={locale}
                    onRefresh={() => setRevision((value) => value + 1)}
                  />
                )}
                {data.methods.transfer && data.bankInstructions && (
                  <form onSubmit={transfer} className="bc-form">
                    <h3>{t("Transferencia bancaria", "Bank transfer")}</h3>
                    <p className="bc-bank">{data.bankInstructions}</p>
                    <label>
                      {t(
                        "Referencia de la transferencia",
                        "Transfer reference",
                      )}
                      <input
                        name="reference"
                        required
                        maxLength={200}
                        autoComplete="off"
                      />
                    </label>
                    <button>
                      {t("Informar transferencia", "Report transfer")}
                    </button>
                    <small>
                      {t(
                        "Informar una transferencia no confirma el pago.",
                        "Reporting a transfer does not confirm payment.",
                      )}
                    </small>
                  </form>
                )}
                {!data.methods.stripe &&
                  !data.methods.yappy &&
                  !(data.methods.transfer && data.bankInstructions) && (
                    <p>
                      {t(
                        "Los métodos de pago aún no están disponibles. Contacta con la administración.",
                        "Payment methods are not available yet. Contact administration.",
                      )}
                    </p>
                  )}
              </fieldset>
            )}
            {payable && !canPay && (
              <p>
                {t(
                  "El propietario o finanzas puede realizar el pago.",
                  "The owner or finance team can pay this order.",
                )}
              </p>
            )}
          </article>
          <article className="bc-card">
            <h3>{t("Progreso de entrega", "Delivery progress")}</h3>
            <p>
              {t("Emitidas", "Issued")}: {order.issued_units}/{order.quantity} ·{" "}
              {t("Listas", "Ready")}: {order.ready_units}/{order.quantity}
            </p>
            <progress
              value={order.ready_units}
              max={Math.max(1, order.quantity)}
              aria-label={t("eSIM listas", "Ready eSIMs")}
            />
            <p>
              {t(
                "La descarga del QR no confirma la activación.",
                "Downloading a QR does not confirm activation.",
              )}
            </p>
            {canDownload && order.ready_units > 0 && (
              <div className="bc-actions">
                <a
                  className="bc-button"
                  href={`/api/portal/commerce/download?orderId=${encodeURIComponent(order.id)}`}
                >
                  {t(
                    "Descargar archivos listos (ZIP)",
                    "Download ready files (ZIP)",
                  )}
                </a>
                {order.units
                  .filter((unit) => unit.status === "ready")
                  .map((unit, index) => (
                    <a
                      key={unit.id}
                      href={`/api/portal/commerce/download?orderId=${encodeURIComponent(order.id)}&unitId=${encodeURIComponent(unit.id)}`}
                    >
                      {t("Descargar eSIM", "Download eSIM")} {index + 1}
                    </a>
                  ))}
              </div>
            )}
          </article>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setError("");
              setRevision((value) => value + 1);
            }}
          >
            {t("Actualizar estado", "Refresh status")}
          </button>
        </>
      )}
    </section>
  );
}
