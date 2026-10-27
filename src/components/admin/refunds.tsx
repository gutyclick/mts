"use client";
import { formatMoney, currencyCode } from "@/lib/currency";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  History,
  LoaderCircle,
  RotateCcw,
  Search,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { z } from "zod";
import type { Locale } from "@/lib/i18n";
import {
  refundLabels,
  refundView,
  type RefundView,
} from "@/lib/payments/refund-model";
import { OperationsShell } from "./operations-shell";
const auditNames: Record<string, [string, string]> = {
  requested: ["Solicitud creada", "Request created"],
  approved_provider_cancellation_not_included: [
    "Reembolso autorizado; gestión del proveedor por separado",
    "Refund approved; provider handling separate",
  ],
  rejected: ["Solicitud rechazada", "Request rejected"],
  execution_claimed: [
    "Comprobación de Stripe iniciada",
    "Stripe check started",
  ],
  stripe_pending: [
    "Stripe mantiene la devolución pendiente",
    "Stripe refund is pending",
  ],
  stripe_succeeded: [
    "Stripe confirmó la devolución",
    "Stripe confirmed the refund",
  ],
  stripe_failed: [
    "Stripe confirmó que la devolución no se completó",
    "Stripe confirmed the refund did not complete",
  ],
  stripe_review: ["Stripe requiere revisión", "Stripe requires review"],
  execution_rejected: [
    "Devolución rechazada antes de completarse",
    "Refund rejected before completion",
  ],
  execution_uncertain_review: [
    "Resultado incierto; unidades retenidas para revisión",
    "Uncertain outcome; units held for review",
  ],
};
export function RefundsDashboard({
  locale,
  initialOrder,
  initialData,
}: {
  locale: Locale;
  initialOrder: string | null;
  initialData: RefundView;
}) {
  const es = locale === "es",
    router = useRouter(),
    [order, setOrder] = useState(initialOrder),
    [input, setInput] = useState(initialOrder ?? ""),
    [data, setData] = useState<RefundView | null>(initialData),
    [selected, setSelected] = useState<string[]>([]),
    [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState<string | null>(null),
    [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0);
  const money = (n: number, currency = data?.order?.currency ?? "USD") =>
    formatMoney(n, currencyCode(currency) ?? "USD", locale);
  const date = (v: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Panama",
    }).format(new Date(v));
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const r = await fetch(
          "/api/admin/refunds" +
            (order ? "?order=" + encodeURIComponent(order) : ""),
          { cache: "no-store", signal: controller.signal },
        );
        if (r.status === 428) {
          router.replace(`/${locale}/admin/security`);
          return;
        }
        if (!r.ok) throw Error();
        const result = refundView.parse(await r.json());
        if (!controller.signal.aborted) {
          setData(result);
          setError("");
        }
      } catch {
        if (!controller.signal.aborted)
          setError(
            es
              ? "No pudimos cargar los reembolsos. Vuelve a intentarlo."
              : "We couldn’t load refunds. Please try again.",
          );
      }
    }
    void load();
    return () => controller.abort();
  }, [order, revision, es, locale, router]);
  async function action(body: Record<string, unknown>) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const r = await fetch("/api/admin/refunds", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.status === 428) {
        router.replace(`/${locale}/admin/security`);
        return;
      }
      const result = await r.json();
      if (!r.ok)
        throw Error(result.error === "fulfillment_busy" ? "busy" : "request");
      setConfirm(null);
      setAck(false);
      setSelected([]);
      if (body.action === "request") setReason("");
      setNotice(
        result.busy
          ? es
            ? "Hay una comprobación en curso. Actualiza el estado en unos instantes."
            : "A check is already running. Refresh the status shortly."
          : es
            ? "Acción registrada. Consulta el estado actualizado; «Pendiente» no significa que el dinero ya se haya devuelto."
            : "Action recorded. Check the updated status; “Pending” does not mean the money has been returned.",
      );
      setRevision((v) => v + 1);
    } catch (e) {
      setError(
        e instanceof Error && e.message === "busy"
          ? es
            ? "Esta eSIM se está procesando. Espera a que termine antes de autorizar el reembolso."
            : "This eSIM is being processed. Wait for it to finish before approving a refund."
          : es
            ? "No se pudo completar la acción. Consulta el estado antes de volver a intentarlo."
            : "The action couldn’t be completed. Check its status before trying again.",
      );
      setRevision((v) => v + 1);
    } finally {
      setBusy(false);
    }
  }
  const total =
    data?.order?.units
      .filter((u) => selected.includes(u.id))
      .reduce((n, u) => n + u.amount, 0) ?? 0;
  return (
    <OperationsShell locale={locale}>
      <header className="operations-header">
        <div>
          <p className="eyebrow">
            MYTRIPSIM · {es ? "ADMINISTRACIÓN" : "ADMINISTRATION"}
          </p>
          <h1>
            <RotateCcw aria-hidden="true" />
            {es ? "Reembolsos" : "Refunds"}
          </h1>
          <p>
            {es
              ? "Revisa cada caso, autoriza el importe y consulta el resultado de Stripe."
              : "Review each case, approve the amount and check Stripe’s result."}
          </p>
        </div>
        <button
          className="button button-secondary"
          disabled={busy}
          onClick={() => setRevision((v) => v + 1)}
        >
          <History size={17} />
          {es ? "Actualizar estado" : "Refresh status"}
        </button>
      </header>
      <div className="operations-policy">
        <ShieldCheck size={21} aria-hidden="true" />
        <p>
          {es
            ? "El dinero vuelve al método de pago original. Reembolsar en Stripe no cancela ni desactiva una eSIM ya emitida; esa gestión se revisa por separado con el proveedor."
            : "Money returns to the original payment method. A Stripe refund does not cancel or deactivate an issued eSIM; review that separately with the provider."}
        </p>
      </div>
      <form
        className="refund-search operations-panel"
        onSubmit={(e) => {
          e.preventDefault();
          if (!z.uuid().safeParse(input.trim()).success) {
            setError(
              es
                ? "Introduce el identificador completo del pedido."
                : "Enter the complete order ID.",
            );
            return;
          }
          setOrder(input.trim());
          setData(null);
          setSelected([]);
          setNotice("");
        }}
      >
        <label htmlFor="refund-order">
          <Search size={18} />
          {es ? "Buscar pedido" : "Find order"}
        </label>
        <div>
          <input
            id="refund-order"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              es ? "Identificador completo del pedido" : "Complete order ID"
            }
            autoComplete="off"
            required
          />
          <button className="button button-primary" disabled={busy}>
            <ArrowRight size={17} />
            {es ? "Revisar" : "Review"}
          </button>
        </div>
      </form>
      {error && (
        <p className="support-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="refund-notice" role="status">
          <CheckCircle2 size={19} />
          {notice}
        </p>
      )}
      {!data && !error && (
        <p className="commerce-muted">
          <LoaderCircle size={18} />
          {es ? "Cargando…" : "Loading…"}
        </p>
      )}
      {order && data && !data.order && (
        <p className="operations-panel">
          {es ? "No encontramos ese pedido." : "We couldn’t find that order."}
        </p>
      )}
      {data?.order && (
        <section className="operations-panel refund-order">
          <div className="refund-section-heading">
            <h2>
              <Wallet size={21} />
              {es ? "Pedido" : "Order"} #
              {data.order.id.slice(0, 8).toUpperCase()}
            </h2>
            <span>
              {data.order.livemode
                ? es
                  ? "Pago real"
                  : "Live payment"
                : es
                  ? "Stripe test"
                  : "Stripe test"}{" "}
              · {money(data.order.amount)}
            </span>
          </div>
          {data.order.status !== "paid" ? (
            <p>
              {es
                ? "Este pedido no tiene un pago confirmado."
                : "This order has no confirmed payment."}
            </p>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void action({
                  action: "request",
                  order: data.order!.id,
                  units: selected,
                  reason,
                });
              }}
            >
              <p className="commerce-muted">
                {es
                  ? "Selecciona las eSIM que se deben revisar. El importe se obtiene del pedido original. Crear una solicitud todavía no devuelve dinero."
                  : "Select the eSIMs to review. The amount comes from the original order. Creating a request does not refund money yet."}
              </p>
              <div className="refund-units">
                {data.order.units.map((u) => (
                  <label className="refund-unit" key={u.id}>
                    <input
                      type="checkbox"
                      checked={selected.includes(u.id)}
                      disabled={busy || Boolean(u.reserved)}
                      onChange={(e) =>
                        setSelected((v) =>
                          e.target.checked
                            ? [...v, u.id]
                            : v.filter((id) => id !== u.id),
                        )
                      }
                    />
                    <span>
                      <strong>
                        {u.destination[locale] ?? u.destination.en} · {u.plan}
                      </strong>
                      <small>
                        {u.dataGb} GB · {u.days} {es ? "días" : "days"} ·{" "}
                        {u.reserved
                          ? es
                            ? "Ya incluida en una solicitud"
                            : "Already included in a request"
                          : u.issued
                            ? es
                              ? "Emitida; revisar con el proveedor"
                              : "Issued; review with provider"
                            : es
                              ? "Pendiente de emisión"
                              : "Awaiting issuance"}
                      </small>
                    </span>
                    <strong>{money(u.amount)}</strong>
                  </label>
                ))}
              </div>
              {!data.order.units.length && (
                <p>
                  {es
                    ? "Este pedido requiere revisión manual en Stripe: no tiene unidades de eSIM registradas."
                    : "This order requires manual review in Stripe: it has no recorded eSIM units."}
                </p>
              )}
              {data.order.units.some((u) => !u.reserved) && (
                <>
                  <label className="refund-reason" htmlFor="refund-reason">
                    {es
                      ? "Motivo y revisión interna"
                      : "Reason and internal review"}
                    <textarea
                      id="refund-reason"
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      minLength={10}
                      maxLength={1000}
                      required
                      disabled={busy}
                      placeholder={
                        es
                          ? "Describe el motivo sin incluir códigos QR ni datos de pago."
                          : "Describe the reason without QR codes or payment details."
                      }
                    />
                  </label>
                  <button
                    className="button button-primary"
                    disabled={
                      busy || !selected.length || reason.trim().length < 10
                    }
                  >
                    {busy ? (
                      <LoaderCircle size={17} />
                    ) : (
                      <ArrowRight size={17} />
                    )}{" "}
                    {es ? "Crear solicitud" : "Create request"} · {money(total)}
                  </button>
                </>
              )}
            </form>
          )}
        </section>
      )}
      <section className="operations-panel refund-history">
        <div className="refund-section-heading">
          <h2>
            <History size={21} />
            {es ? "Solicitudes e historial" : "Requests and history"}
          </h2>
          {order ? (
            <button
              className="button button-secondary"
              disabled={busy}
              onClick={() => {
                setOrder(null);
                setInput("");
                setData(null);
                setSelected([]);
              }}
            >
              {es ? "Ver todos los pedidos" : "View all orders"}
            </button>
          ) : (
            <span>
              {es
                ? "Solicitudes activas y recientes"
                : "Active and recent requests"}
            </span>
          )}
        </div>
        {data?.recent.length === 0 && (
          <p className="commerce-muted">
            {es
              ? "Todavía no hay solicitudes de reembolso."
              : "There are no refund requests yet."}
          </p>
        )}
        {data?.recent.map((r) => (
          <article className="refund-record" key={r.id}>
            <div className="refund-section-heading">
              <div>
                <strong>
                  {money(r.amount, r.currency)} · #
                  {r.order_id.slice(0, 8).toUpperCase()}
                </strong>
                <small>
                  {date(r.updated_at)} ·{" "}
                  {r.livemode
                    ? es
                      ? "Pago real"
                      : "Live payment"
                    : "Stripe test"}
                </small>
              </div>
              <span className="refund-state" data-state={r.state}>
                {refundLabels[locale][r.state]}
              </span>
            </div>
            <p>{r.reason}</p>
            <div className="refund-actions">
              <button
                className="button button-secondary"
                disabled={busy}
                onClick={() => {
                  setInput(r.order_id);
                  setOrder(r.order_id);
                  setData(null);
                  setSelected([]);
                }}
              >
                {es ? "Ver pedido" : "View order"}
              </button>
              {r.state === "requested" && (
                <>
                  <button
                    className="button button-secondary"
                    disabled={busy}
                    onClick={() => void action({ action: "reject", id: r.id })}
                  >
                    {es ? "Rechazar" : "Reject"}
                  </button>
                  <button
                    className="button button-primary"
                    disabled={busy}
                    onClick={() => {
                      setConfirm(r.id);
                      setAck(false);
                    }}
                  >
                    {es ? "Revisar y autorizar" : "Review and approve"}
                  </button>
                </>
              )}
              {["approved", "processing", "pending", "review"].includes(
                r.state,
              ) && (
                <button
                  className="button button-secondary"
                  disabled={busy}
                  onClick={() => void action({ action: "reconcile", id: r.id })}
                >
                  {es ? "Comprobar en Stripe" : "Check Stripe"}
                </button>
              )}
            </div>
            {confirm === r.id && (
              <div
                className="refund-confirm"
                role="region"
                aria-label={
                  es ? "Confirmación de reembolso" : "Refund confirmation"
                }
              >
                <h3>
                  {es ? "Autorizar devolución de" : "Approve refund of"}{" "}
                  {money(r.amount, r.currency)}
                </h3>
                <p>
                  {es
                    ? "Esta acción puede devolver dinero real. Confirma la revisión del caso y de la eSIM antes de continuar. Una devolución pendiente o incierta mantiene retenida la emisión de las unidades seleccionadas."
                    : "This action can return real money. Confirm your review of the case and eSIM before continuing. A pending or uncertain refund holds issuance of the selected units."}
                </p>
                <label>
                  <input
                    type="checkbox"
                    checked={ack}
                    disabled={busy}
                    onChange={(e) => setAck(e.target.checked)}
                  />
                  {es
                    ? "Autorizo este importe y entiendo que una eSIM ya emitida no se desactiva automáticamente."
                    : "I approve this amount and understand that an issued eSIM is not automatically deactivated."}
                </label>
                <div className="refund-actions">
                  <button
                    className="button button-secondary"
                    disabled={busy}
                    onClick={() => {
                      setConfirm(null);
                      setAck(false);
                    }}
                  >
                    {es ? "Volver" : "Back"}
                  </button>
                  <button
                    className="button button-primary"
                    disabled={busy || !ack}
                    onClick={() =>
                      void action({ action: "approve", id: r.id, ack: true })
                    }
                  >
                    {busy ? (
                      <LoaderCircle size={17} />
                    ) : (
                      <RotateCcw size={17} />
                    )}{" "}
                    {es ? "Reembolsar" : "Refund"} {money(r.amount, r.currency)}
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </section>
      {Boolean(data?.audit.length) && (
        <details className="operations-panel refund-audit">
          <summary>
            <History size={19} />
            {es
              ? "Bitácora de autorizaciones y resultados"
              : "Approval and result audit"}
          </summary>
          <ol>
            {data!.audit.map((a, i) => (
              <li key={`${a.request_id}-${a.created_at}-${i}`}>
                <strong>
                  {auditNames[a.action]?.[es ? 0 : 1] ??
                    (es ? "Acción registrada" : "Action recorded")}
                </strong>
                <small>
                  {date(a.created_at)} · #
                  {a.request_id.slice(0, 8).toUpperCase()} ·{" "}
                  {a.actor
                    ? `Admin #${a.actor.slice(0, 8).toUpperCase()}`
                    : "Stripe"}
                </small>
              </li>
            ))}
          </ol>
        </details>
      )}
    </OperationsShell>
  );
}
