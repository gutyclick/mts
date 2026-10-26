"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Mail,
  RefreshCw,
  Wallet,
  Clock3,
  LoaderCircle,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import {
  operationsSnapshotSchema,
  type OperationsSnapshot,
} from "@/lib/operations/model";
import { OperationsShell } from "./operations-shell";
const names = {
  es: {
    paid_without_delivery: "Pedido pagado pendiente de entrega",
    email_bounced: "El correo de entrega ha rebotado",
    email_failed: "No se pudo enviar el correo",
    email_complained: "Correo marcado como no deseado",
    email_delayed: "Correo de entrega retrasado",
    provider_low_balance: "Saldo bajo en eSIM Access",
    provider_check_failed: "No se pudo comprobar el saldo",
  },
  en: {
    paid_without_delivery: "Paid order awaiting delivery",
    email_bounced: "Delivery email bounced",
    email_failed: "Email could not be sent",
    email_complained: "Email marked as spam",
    email_delayed: "Delivery email delayed",
    provider_low_balance: "Low eSIM Access balance",
    provider_check_failed: "Balance check failed",
  },
};
export function OperationsDashboard({ locale }: { locale: Locale }) {
  const es = locale === "es",
    router = useRouter(),
    [data, setData] = useState<OperationsSnapshot | null>(null),
    [error, setError] = useState(false),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState<string | null>(null),
    [history, setHistory] = useState(false);
  const time = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale, {
          dateStyle: "short",
          timeStyle: "short",
          timeZone: "America/Panama",
        }).format(new Date(value))
      : es
        ? "Aún sin comprobar"
        : "Not checked yet";
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      try {
        const r = await fetch("/api/admin/operations", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (r.status === 428) {
          router.replace(`/${locale}/admin/security`);
          return;
        }
        if (!r.ok) throw Error();
        const d = operationsSnapshotSchema.parse(await r.json());
        if (!controller.signal.aborted) {
          setData(d);
          setError(false);
        }
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 30000);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [revision, locale, router]);
  async function action(
    body: { action: "acknowledge"; id: string } | { action: "check" },
  ) {
    setBusy(body.action === "check" ? "check" : body.id);
    try {
      const r = await fetch("/api/admin/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.status === 428) {
        router.replace(`/${locale}/admin/security`);
        return;
      }
      if (!r.ok) throw Error();
      setRevision((v) => v + 1);
    } catch {
      setError(true);
    } finally {
      setBusy(null);
    }
  }
  const unresolved = data?.alerts.filter((a) => a.state !== "resolved") ?? [],
    visible =
      data?.alerts.filter((a) =>
        history ? a.state === "resolved" : a.state !== "resolved",
      ) ?? [];
  return (
    <OperationsShell locale={locale}>
      <header className="operations-heading">
        <div>
          <p className="eyebrow">
            MYTRIPSIM · {es ? "CONTROL OPERATIVO" : "OPERATIONAL CONTROL"}
          </p>
          <h1>{es ? "Todo bajo control" : "Keep everything on track"}</h1>
          <p>
            {es
              ? "Entregas, correos y saldo del proveedor en un mismo lugar."
              : "Delivery, email and supplier balance in one place."}
          </p>
        </div>
        <button
          className="button button-secondary"
          disabled={!!busy}
          onClick={() => void action({ action: "check" })}
        >
          {busy === "check" ? (
            <LoaderCircle size={17} />
          ) : (
            <RefreshCw size={17} />
          )}{" "}
          {es ? "Comprobar ahora" : "Check now"}
        </button>
      </header>
      {error && (
        <div className="support-error" role="alert">
          {es
            ? "No pudimos actualizar. Los datos anteriores se conservan."
            : "We couldn’t refresh. The previous information is preserved."}
          <button onClick={() => setRevision((v) => v + 1)}>
            {es ? "Reintentar" : "Retry"}
          </button>
        </div>
      )}
      {!data && !error && (
        <p role="status">
          <LoaderCircle size={20} />
          {es ? "Cargando operaciones…" : "Loading operations…"}
        </p>
      )}
      {data && (
        <>
          <div className="operations-stats">
            <article>
              <span className="operations-icon">
                <AlertCircle size={23} />
              </span>
              <p>{es ? "Incidencias abiertas" : "Unresolved incidents"}</p>
              <strong>{unresolved.length}</strong>
              <small>
                {es
                  ? "Incluye las que ya estás revisando"
                  : "Includes incidents under review"}
              </small>
            </article>
            <article>
              <span className="operations-icon">
                <Wallet size={23} />
              </span>
              <p>{es ? "Saldo del proveedor" : "Supplier balance"}</p>
              <strong>
                {data.settings.balanceUnits === null
                  ? "—"
                  : `USD ${(data.settings.balanceUnits / 10000).toFixed(2)}`}
              </strong>
              <small>
                {data.settings.balanceOk
                  ? time(data.settings.lastBalanceAt)
                  : es
                    ? "Último dato; comprobación pendiente"
                    : "Last known value; check pending"}
              </small>
            </article>
            <article>
              <span className="operations-icon">
                <Mail size={23} />
              </span>
              <p>{es ? "Avisos por correo" : "Email alerts"}</p>
              <strong className="operations-small-value">
                {data.settings.enabled
                  ? es
                    ? "Activos"
                    : "Active"
                  : es
                    ? "Pendientes de configuración"
                    : "Configuration pending"}
              </strong>
              <small>{data.settings.recipient}</small>
            </article>
          </div>
          <div className="operations-policy">
            <Activity size={20} />
            <div>
              <strong>
                {es
                  ? "Comprobación cada cinco minutos"
                  : "Checks every five minutes"}
              </strong>
              <p>
                {es
                  ? "Aviso por entrega pendiente tras 10 minutos y saldo inferior a"
                  : "Alerts for delivery pending after 10 minutes and balance below"}{" "}
                USD {(data.settings.thresholdUnits / 10000).toFixed(2)}.{" "}
                {es
                  ? "Cada incidencia se notifica una vez; los pedidos de prueba quedan excluidos."
                  : "Each incident is notified once; test orders are excluded."}
              </p>
              <small>
                <Clock3 size={13} />
                {es ? "Última comprobación" : "Last check"}:{" "}
                {time(data.settings.lastRunAt)}
              </small>
            </div>
          </div>
          <nav
            className="operations-tabs"
            aria-label={es ? "Incidencias" : "Incidents"}
          >
            <button
              aria-current={!history ? "page" : undefined}
              onClick={() => setHistory(false)}
            >
              {es ? "Por atender" : "Needs attention"} · {unresolved.length}
            </button>
            <button
              aria-current={history ? "page" : undefined}
              onClick={() => setHistory(true)}
            >
              {es ? "Resueltas" : "Resolved"}
            </button>
          </nav>
          <div className="operations-alerts">
            {!visible.length ? (
              <div className="operations-empty">
                <CheckCircle2 size={35} />
                <h2>
                  {es
                    ? history
                      ? "Sin incidencias resueltas"
                      : "Sin incidencias pendientes"
                    : history
                      ? "No resolved incidents"
                      : "No pending incidents"}
                </h2>
                <p>
                  {es
                    ? "Aquí aparecerán las incidencias detectadas por las comprobaciones."
                    : "Issues detected by the checks will appear here."}
                </p>
              </div>
            ) : (
              visible.map((alert) => (
                <article
                  key={alert.id}
                  className={`operations-alert is-${alert.state}`}
                >
                  <span className="operations-icon">
                    {alert.state === "resolved" ? (
                      <CheckCircle2 size={22} />
                    ) : (
                      <AlertCircle size={22} />
                    )}
                  </span>
                  <div>
                    <h2>{names[locale][alert.kind]}</h2>
                    <p>
                      {alert.order_id
                        ? `${es ? "Pedido" : "Order"} #${alert.order_id.slice(0, 8).toUpperCase()}`
                        : es
                          ? "Cuenta del proveedor"
                          : "Supplier account"}
                    </p>
                    <small>
                      {es ? "Detectada" : "Detected"}: {time(alert.opened_at)}
                    </small>
                    <p className="operations-alert-meta">
                      {alert.notification_state === "review"
                        ? es
                          ? "El aviso necesita revisión de entrega"
                          : "Notification delivery needs review"
                        : alert.notified_at
                          ? es
                            ? "Aviso enviado"
                            : "Notification sent"
                          : es
                            ? "Aviso pendiente"
                            : "Notification pending"}
                      {alert.state === "acknowledged"
                        ? ` · ${es ? "En revisión" : "Under review"}`
                        : ""}
                    </p>
                  </div>
                  {alert.state === "open" && (
                    <button
                      className="button button-secondary"
                      disabled={!!busy}
                      onClick={() =>
                        void action({ action: "acknowledge", id: alert.id })
                      }
                    >
                      {es ? "Estoy revisando" : "I’m reviewing this"}
                    </button>
                  )}
                </article>
              ))
            )}
          </div>
          <p className="operations-footnote">
            {es
              ? "Marcar como revisada no reenvía correos, no compra otra eSIM y no devuelve el pago. La incidencia se resuelve cuando la comprobación confirma que el problema ya no existe."
              : "Acknowledging an incident does not resend email, buy another eSIM or refund a payment. It resolves when a check confirms the problem no longer exists."}
          </p>
        </>
      )}
    </OperationsShell>
  );
}
