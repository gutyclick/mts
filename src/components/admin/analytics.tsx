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
                    label: es ? "Inicia el pago" : "Starts payment",
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
              ? "Los importes incluyen todos los pedidos reales confirmados en el periodo, aunque no hayan aceptado estadísticas. No representan ingresos netos ni se usan como denominador del embudo. Los datos de sesión empiezan a registrarse desde la activación y se conservan 30 días, con limpieza diaria."
              : "Amounts include all confirmed live orders in the period, including those without statistics consent. They are not net revenue and are not used as the funnel denominator. Session collection begins at activation and lasts 30 days, with daily cleanup."}
          </p>
        </>
      )}
    </OperationsShell>
  );
}
