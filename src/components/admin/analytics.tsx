"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart3, RefreshCw } from "lucide-react";
import { z } from "zod";
import { type Locale, pathFor } from "@/lib/i18n";
import { OperationsShell } from "./operations-shell";
const count = z.number().nonnegative(),
  schema = z.object({
    days: z.number(),
    funnel: z.object({
      sessions: count,
      view: count,
      cart: count,
      checkout: count,
      paid: count,
    }),
    financial: z.object({ orders: count, grossCents: count }),
    checkoutFunnel: z.object({
      entry: count,
      contactReady: count,
      paymentReady: count,
      paymentAttempt: count,
      paymentError: count,
      couponAttempted: count,
      couponApplied: count,
      couponRejected: count,
      paid: count,
      incomplete: count,
      matured: count,
      maturedUnpaid: count,
      stopped: z.object({
        afterAttempt: count,
        beforeContact: count,
        formUnavailable: count,
        beforeAttempt: count,
      }),
    }),
    destinations: z.array(
      z.object({
        slug: z.string(),
        name: z.object({ es: z.string(), en: z.string() }),
        views: count,
        carts: count,
      }),
    ),
  });
export function AnalyticsDashboard({ locale }: { locale: Locale }) {
  const es = locale === "es",
    router = useRouter(),
    [days, setDays] = useState(30),
    [revision, setRevision] = useState(0),
    [data, setData] = useState<z.infer<typeof schema> | null>(null),
    [error, setError] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/api/admin/analytics?days=${days}`, {
      cache: "no-store",
      signal: abort.signal,
    })
      .then(async (r) => {
        if (r.status === 428) {
          router.replace(`/${locale}/admin/security`);
          return null;
        }
        if (!r.ok) throw Error();
        return schema.parse(await r.json());
      })
      .then((value) => {
        if (value) {
          setData(value);
          setError(false);
        }
      })
      .catch(() => {
        if (!abort.signal.aborted) setError(true);
      });
    return () => abort.abort();
  }, [days, revision, locale, router]);
  const money = (n: number) =>
      new Intl.NumberFormat(locale, {
        style: "currency",
        currency: "USD",
      }).format(n / 100),
    percent = (n: number, d: number) =>
      d
        ? new Intl.NumberFormat(locale, {
            style: "percent",
            maximumFractionDigits: 1,
          }).format(n / d)
        : "—";
  return (
    <OperationsShell locale={locale}>
      <header className="operations-heading">
        <div>
          <p className="eyebrow">MYTRIPSIM / {es ? "VENTAS" : "SALES"}</p>
          <h1>
            <BarChart3 size={27} />{" "}
            {es ? "Ventas y conversión" : "Sales and conversion"}
          </h1>
          <p>
            {es
              ? "Comprende cómo los viajeros llegan a comprar."
              : "Understand how travelers reach a purchase."}
          </p>
        </div>
        <div className="analytics-period">
          <label htmlFor="analytics-days">{es ? "Periodo" : "Period"}</label>
          <select
            id="analytics-days"
            value={days}
            onChange={(e) => {
              setData(null);
              setDays(Number(e.target.value));
            }}
          >
            {[1, 7, 30].map((n) => (
              <option value={n} key={n}>
                {es
                  ? `Últimos ${n === 1 ? "1 día" : `${n} días`}`
                  : `Last ${n === 1 ? "1 day" : `${n} days`}`}
              </option>
            ))}
          </select>
          <button
            className="button button-secondary"
            onClick={() => setRevision((n) => n + 1)}
          >
            <RefreshCw size={16} />
            {es ? "Actualizar" : "Refresh"}
          </button>
        </div>
      </header>
      {error && (
        <p role="alert">
          {es
            ? "No pudimos actualizar el informe. Inténtalo de nuevo."
            : "We could not refresh the report. Please try again."}
        </p>
      )}
      {!data && !error && (
        <p role="status">{es ? "Preparando el informe…" : "Loading report…"}</p>
      )}
      {data && (
        <>
          <div className="analytics-grid">
            <div className="analytics-card">
              <small>
                {es ? "Ventas brutas confirmadas" : "Confirmed gross sales"}
              </small>
              <strong>{money(data.financial.grossCents)}</strong>
              <small>{es ? "Antes de reembolsos" : "Before refunds"}</small>
            </div>
            <div className="analytics-card">
              <small>{es ? "Pedidos pagados" : "Paid orders"}</small>
              <strong>{data.financial.orders}</strong>
              <small>{es ? "Solo pagos reales" : "Live payments only"}</small>
            </div>
            <div className="analytics-card">
              <small>{es ? "Sesiones registradas" : "Recorded sessions"}</small>
              <strong>{data.funnel.sessions}</strong>
              <small>
                {es
                  ? "Con permiso para estadísticas"
                  : "With statistics consent"}
              </small>
            </div>
            <div className="analytics-card">
              <small>
                {es ? "Sesiones con compra" : "Sessions with a purchase"}
              </small>
              <strong>{percent(data.funnel.paid, data.funnel.sessions)}</strong>
              <small>
                {es
                  ? "Del total de sesiones registradas"
                  : "Of recorded sessions"}
              </small>
            </div>
          </div>
          <section className="analytics-card">
            <h2>
              {es ? "Del destino a la compra" : "From destination to purchase"}
            </h2>
            <p className="analytics-note">
              {es
                ? "Sesiones distintas con consentimiento que completaron cada etapa durante el periodo. Una sesión dura 30 minutos; las compras posteriores no se atribuyen a ella."
                : "Distinct consenting sessions that completed each stage during the period. A session lasts 30 minutes; later purchases are not attributed to it."}
            </p>
            <ol className="analytics-funnel">
              {(
                [
                  {
                    key: "view",
                    label: es ? "Consulta un destino" : "Views a destination",
                  },
                  {
                    key: "cart",
                    label: es ? "Añade al carrito" : "Adds to cart",
                  },
                  {
                    key: "checkout",
                    label: es ? "Crea un pedido" : "Creates an order",
                  },
                  {
                    key: "paid",
                    label: es ? "Completa la compra" : "Completes purchase",
                  },
                ] as const
              ).map((stage) => (
                <li key={stage.key}>
                  <span>{stage.label}</span>
                  <div className="analytics-bar" aria-hidden="true">
                    <span
                      style={{
                        width: `${data.funnel.sessions ? Math.min(100, (data.funnel[stage.key] / data.funnel.sessions) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <strong>
                    {data.funnel[stage.key]}{" "}
                    <small>
                      ({percent(data.funnel[stage.key], data.funnel.sessions)})
                    </small>
                  </strong>
                </li>
              ))}
            </ol>
            <p className="analytics-note">
              {es
                ? "Cada etapa se cuenta de forma independiente: alguien puede recuperar un carrito o llegar directamente al pago. Los porcentajes usan sesiones registradas, no todos los visitantes. Rechazos, bloqueadores y fallos técnicos pueden reducir los registros."
                : "Each stage is counted independently: someone may restore a cart or go directly to payment. Percentages use recorded sessions, not all visitors. Refusals, blockers and technical failures may reduce recorded activity."}
            </p>
          </section>
          <section className="analytics-card analytics-checkout">
            <h2>{es ? "Dentro del checkout" : "Inside checkout"}</h2>
            <p className="analytics-note">
              {es
                ? "Sesiones con consentimiento cuya primera entrada al checkout está en el periodo. Cada etapa se cuenta una vez por sesión, independientemente del orden; no son intentos ni personas únicas. Los pagos proceden del estado confirmado del servidor, después de entrar al checkout y dentro de la sesión original de 30 minutos."
                : "Consenting sessions whose first checkout entry falls in the period. Each stage counts once per session, independently of sequence; these are not attempt totals or unique people. Paid comes from confirmed server status after checkout entry and within the original 30-minute session."}
            </p>
            <ol className="analytics-funnel">
              {(
                [
                  ["entry", es ? "Entra al checkout" : "Enters checkout"],
                  ["contactReady", es ? "Contacto listo" : "Contact ready"],
                  [
                    "paymentReady",
                    es ? "Formulario de pago listo" : "Payment form ready",
                  ],
                  ["paymentAttempt", es ? "Intenta pagar" : "Attempts payment"],
                  ["paid", es ? "Compra confirmada" : "Confirmed purchase"],
                ] as const
              ).map(([key, label]) => (
                <li key={key}>
                  <span>{label}</span>
                  <div className="analytics-bar" aria-hidden="true">
                    <span
                      style={{
                        width: `${data.checkoutFunnel.entry ? Math.min(100, (data.checkoutFunnel[key] / data.checkoutFunnel.entry) * 100) : 0}%`,
                      }}
                    />
                  </div>
                  <strong>
                    {data.checkoutFunnel[key]}{" "}
                    <small>
                      (
                      {percent(
                        data.checkoutFunnel[key],
                        data.checkoutFunnel.entry,
                      )}
                      )
                    </small>
                  </strong>
                </li>
              ))}
            </ol>
            <dl className="analytics-checkout-status">
              <div>
                <dt>
                  {es ? "Incompletas, aún abiertas" : "Incomplete, still open"}
                </dt>
                <dd>{data.checkoutFunnel.incomplete}</dd>
              </div>
              <div>
                <dt>
                  {es
                    ? "Sin compra al cerrar la ventana"
                    : "Unpaid after window closes"}
                </dt>
                <dd>
                  {data.checkoutFunnel.maturedUnpaid}{" "}
                  <small>
                    (
                    {percent(
                      data.checkoutFunnel.maturedUnpaid,
                      data.checkoutFunnel.matured,
                    )}
                    )
                  </small>
                </dd>
              </div>
              <div>
                <dt>
                  {es
                    ? "Sesiones con error de pago"
                    : "Sessions with payment error"}
                </dt>
                <dd>{data.checkoutFunnel.paymentError}</dd>
              </div>
              <div>
                <dt>
                  {es
                    ? "Cupón intentado / aplicado / rechazado"
                    : "Coupon attempted / applied / rejected"}
                </dt>
                <dd>
                  {data.checkoutFunnel.couponAttempted} /{" "}
                  {data.checkoutFunnel.couponApplied} /{" "}
                  {data.checkoutFunnel.couponRejected}
                </dd>
              </div>
            </dl>
            <h3>
              {es
                ? "Última etapa observada sin compra"
                : "Last observed stage without purchase"}
            </h3>
            <dl className="analytics-checkout-status">
              {(
                [
                  [
                    "beforeContact",
                    es ? "Sin datos de contacto" : "No contact details",
                  ],
                  [
                    "formUnavailable",
                    es ? "Formulario no listo" : "Payment form not ready",
                  ],
                  [
                    "beforeAttempt",
                    es ? "Sin intentar pagar" : "No payment attempt",
                  ],
                  [
                    "afterAttempt",
                    es
                      ? "Después de intentar pagar"
                      : "After a payment attempt",
                  ],
                ] as const
              ).map(([key, label]) => (
                <div key={key}>
                  <dt>{label}</dt>
                  <dd>{data.checkoutFunnel.stopped[key]}</dd>
                </div>
              ))}
            </dl>
            <p className="analytics-note">
              {es
                ? "El abandono medido espera 30 minutos desde la primera entrada al checkout, aunque la navegación empezara antes. Las etapas y los pagos solo se observan mientras sigue vigente la sesión original; no se atribuyen compras posteriores. Las cuatro últimas etapas agrupan sin solaparse todas las sesiones maduras sin compra; describen observaciones, no prueban causas. Los grupos de cupón pueden solaparse si alguien corrige un cupón. No se guardan correos, códigos de cupón, datos de pago ni mensajes de error. La medición comienza al activar esta versión y puede ser incompleta por bloqueadores o fallos técnicos."
                : "Measured abandonment waits 30 minutes after first checkout entry, even if browsing started earlier. Stages and payments are observed only while the original session remains valid; later purchases are not attributed. The four last-stage groups partition all matured unpaid sessions without overlap; observations do not prove causes. Coupon groups can overlap when someone corrects a coupon. No emails, coupon codes, payment details or error messages are stored. Measurement starts when this version is enabled and may be incomplete due to blockers or technical failures."}
            </p>
          </section>
          <section className="analytics-card" style={{ marginTop: 20 }}>
            <h2>{es ? "Destinos con más interés" : "Top destinations"}</h2>
            {!data.destinations.length ? (
              <p>
                {es
                  ? "Aún no hay actividad registrada en este periodo."
                  : "No recorded activity for this period yet."}
              </p>
            ) : (
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                  <thead>
                    <tr>
                      <th>{es ? "Destino" : "Destination"}</th>
                      <th>
                        {es ? "Sesiones con visita" : "Sessions with views"}
                      </th>
                      <th>
                        {es
                          ? "Sesiones con carrito"
                          : "Sessions with cart additions"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.destinations.map((d) => (
                      <tr key={d.slug}>
                        <td>
                          <Link href={pathFor(locale, undefined, d.slug)}>
                            {d.name[locale]}
                          </Link>
                        </td>
                        <td>{d.views}</td>
                        <td>{d.carts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
          <p className="analytics-note">
            {es
              ? "Los importes incluyen todos los pedidos reales confirmados en el periodo, aunque no hayan aceptado estadísticas. Los importes se expresan en USD al precio base del pedido, antes de comisiones, diferencias de liquidación y reembolsos; no son ingresos netos ni el denominador del embudo. Los datos de sesión empiezan a registrarse desde la activación y se conservan 30 días, con limpieza diaria."
              : "Amounts include all confirmed live orders in the period, including those without statistics consent. Amounts use each order’s original USD base price before fees, settlement exchange differences and refunds; they are not net revenue or the funnel denominator. Session collection begins at activation and lasts 30 days, with daily cleanup."}
          </p>
        </>
      )}
    </OperationsShell>
  );
}
