"use client";
import { useEffect, useState } from "react";
import {
  Building2,
  Check,
  ClipboardCheck,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { OperationsShell } from "./operations-shell";
import type { Locale } from "@/lib/i18n";
import { businessMessage } from "@/components/portal/portal-business-copy";
type Application = {
  id: string;
  name: string;
  website: string;
  note: string;
  status: string;
  created_at: string;
  email: string;
};
type Company = {
  id: string;
  name: string;
  status: "active" | "suspended";
  created_at: string;
  members: number;
};
type OrderRequest = {
  id: string;
  company_id: string;
  company_name: string;
  trip_name: string;
  departure: string;
  returning: string;
  travelers: number;
  mode: string;
  plan_id: string;
  plan_name: string;
  days: number;
  data_gb: number;
  quantity: number;
  version: number;
  status: "pending" | "approved" | "changes";
  review_note: string | null;
  created_at: string;
};
type Snapshot = {
  applications: Application[];
  companies: Company[];
  requests: OrderRequest[];
};
export function CompaniesAdmin({ locale }: { locale: Locale }) {
  const es = locale === "es";
  const [data, setData] = useState<Snapshot | null>(null),
    [tab, setTab] = useState<"applications" | "companies" | "requests">(
      "applications",
    ),
    [notes, setNotes] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/companies", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok) throw Error(value.error ?? "unavailable");
        if (!controller.signal.aborted) {
          setData(value);
          setLoading(false);
        }
      })
      .catch((value) => {
        if (!controller.signal.aborted) {
          setError(
            businessMessage(
              value instanceof Error ? value.message : "unavailable",
              locale,
            ),
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [revision, locale]);
  async function action(value: unknown) {
    if (busy || loading) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      const response = await fetch("/api/admin/companies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error ?? "unavailable");
      setSuccess(
        es
          ? "Cambio guardado y registrado en auditoría."
          : "Change saved and recorded in the audit log.",
      );
      setLoading(true);
      setRevision((v) => v + 1);
    } catch (value) {
      setError(
        businessMessage(
          value instanceof Error ? value.message : "unavailable",
          locale,
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  const note = (id: string) => notes[id] ?? "";
  return (
    <OperationsShell locale={locale}>
      <div className="business-admin">
        <header className="business-admin-heading">
          <div>
            <span>MYTRIPSIM BUSINESS</span>
            <h1>{es ? "Empresas y solicitudes" : "Companies and requests"}</h1>
            <p>
              {es
                ? "Aprueba altas, revisa pedidos y controla el acceso de cada empresa."
                : "Approve applications, review requests and manage company access."}
            </p>
          </div>
          <button
            className="business-admin-button"
            type="button"
            disabled={loading || busy}
            onClick={() => {
              setLoading(true);
              setError("");
              setRevision((v) => v + 1);
            }}
          >
            <RefreshCw size={17} />
            {es ? "Actualizar" : "Refresh"}
          </button>
        </header>
        <div className="business-admin-notice">
          <ShieldCheck size={20} />
          <p>
            {es
              ? "La aprobación registra la revisión comercial. Esta fase no realiza cobros ni emite eSIM. La emisión requerirá sus controles de pago, precio y proveedor."
              : "Approval records a commercial review. This phase does not charge or issue eSIMs. Issuance will require payment, pricing and provider checks."}
          </p>
        </div>
        <nav
          className="business-admin-tabs"
          aria-label={es ? "Gestión de empresas" : "Business management"}
        >
          {(
            [
              {
                key: "applications",
                label: es ? "Altas pendientes" : "Applications",
                icon: Building2,
              },
              {
                key: "requests",
                label: es ? "Solicitudes de eSIM" : "eSIM requests",
                icon: ClipboardCheck,
              },
              {
                key: "companies",
                label: es ? "Empresas" : "Companies",
                icon: Building2,
              },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
            >
              <Icon size={17} />
              {label}
              {data && <span>{data[key].length}</span>}
            </button>
          ))}
        </nav>
        {error && (
          <p role="alert" className="business-admin-error">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="business-admin-success">
            {success}
          </p>
        )}
        {loading && <p role="status">{es ? "Cargando…" : "Loading…"}</p>}
        {data && (
          <>
            <p className="business-admin-limit">
              {es
                ? "Hasta 200 altas y solicitudes recientes; hasta 500 empresas."
                : "Up to 200 recent applications and requests; up to 500 companies."}
            </p>
            <div className="business-admin-list">
              {tab === "applications"
                ? data.applications.map((application) => (
                    <section
                      className="business-admin-card"
                      key={application.id}
                    >
                      <header>
                        <div>
                          <h2>{application.name}</h2>
                          <p>{application.email}</p>
                        </div>
                        <span className="business-admin-pill">
                          {es ? "Alta pendiente" : "Pending application"}
                        </span>
                      </header>
                      {application.website && (
                        <a
                          className="business-admin-link"
                          href={application.website}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {application.website}
                        </a>
                      )}
                      {application.note && <p>{application.note}</p>}
                      <label>
                        {es
                          ? "Nota para la empresa (opcional)"
                          : "Note for the company (optional)"}
                        <textarea
                          maxLength={1000}
                          rows={2}
                          value={note(application.id)}
                          onChange={(event) =>
                            setNotes({
                              ...notes,
                              [application.id]: event.target.value,
                            })
                          }
                        />
                      </label>
                      <div className="business-admin-actions">
                        <button
                          className="business-admin-button"
                          type="button"
                          disabled={busy || loading}
                          onClick={() =>
                            action({
                              action: "approve_application",
                              id: application.id,
                              note: note(application.id),
                            })
                          }
                        >
                          <Check size={17} />
                          {es ? "Aprobar empresa" : "Approve company"}
                        </button>
                        <button
                          className="business-admin-button business-admin-secondary"
                          type="button"
                          disabled={busy || loading}
                          onClick={() =>
                            action({
                              action: "reject_application",
                              id: application.id,
                              note: note(application.id),
                            })
                          }
                        >
                          {es ? "Rechazar alta" : "Reject application"}
                        </button>
                      </div>
                    </section>
                  ))
                : tab === "companies"
                  ? data.companies.map((company) => (
                      <section className="business-admin-card" key={company.id}>
                        <header>
                          <div>
                            <h2>{company.name}</h2>
                            <p>
                              {company.members} {es ? "miembros" : "members"}
                            </p>
                          </div>
                          <span className="business-admin-pill">
                            {company.status === "active"
                              ? es
                                ? "Activa"
                                : "Active"
                              : es
                                ? "Suspendida"
                                : "Suspended"}
                          </span>
                        </header>
                        <label>
                          {es
                            ? "Motivo del cambio (obligatorio)"
                            : "Reason for change (required)"}
                          <textarea
                            rows={2}
                            maxLength={1000}
                            value={note(company.id)}
                            onChange={(event) =>
                              setNotes({
                                ...notes,
                                [company.id]: event.target.value,
                              })
                            }
                          />
                        </label>
                        <button
                          className="business-admin-button business-admin-secondary"
                          type="button"
                          disabled={busy || loading || !note(company.id).trim()}
                          onClick={() =>
                            action({
                              action: "company_status",
                              id: company.id,
                              status:
                                company.status === "active"
                                  ? "suspended"
                                  : "active",
                              note: note(company.id),
                            })
                          }
                        >
                          {company.status === "active"
                            ? es
                              ? "Suspender acceso"
                              : "Suspend access"
                            : es
                              ? "Restablecer acceso"
                              : "Restore access"}
                        </button>
                      </section>
                    ))
                  : data.requests.map((request) => (
                      <section className="business-admin-card" key={request.id}>
                        <header>
                          <div>
                            <span>{request.company_name}</span>
                            <h2>{request.trip_name}</h2>
                          </div>
                          <span className="business-admin-pill">
                            {request.status === "pending"
                              ? es
                                ? "Pendiente"
                                : "Pending"
                              : request.status === "approved"
                                ? es
                                  ? "Aprobada"
                                  : "Approved"
                                : es
                                  ? "Requiere cambios"
                                  : "Changes requested"}
                          </span>
                        </header>
                        <dl>
                          <div>
                            <dt>{es ? "Plan exacto" : "Exact plan"}</dt>
                            <dd>
                              {request.plan_name}
                              <small>{request.plan_id}</small>
                            </dd>
                          </div>
                          <div>
                            <dt>{es ? "Grupo" : "Group"}</dt>
                            <dd>
                              {request.travelers}{" "}
                              {es ? "viajeros" : "travelers"} ·{" "}
                              {request.quantity} eSIM
                            </dd>
                          </div>
                          <div>
                            <dt>{es ? "Fechas" : "Dates"}</dt>
                            <dd>
                              {request.departure} → {request.returning}
                            </dd>
                          </div>
                          <div>
                            <dt>{es ? "Modalidad" : "Model"}</dt>
                            <dd>
                              {request.mode === "package"
                                ? es
                                  ? "Paquete"
                                  : "Package"
                                : es
                                  ? "Venta individual"
                                  : "Individual sale"}
                            </dd>
                          </div>
                        </dl>
                        {request.status === "pending" ? (
                          <>
                            <label>
                              {es ? "Nota de revisión" : "Review note"}
                              <textarea
                                rows={2}
                                maxLength={1000}
                                value={note(request.id)}
                                onChange={(event) =>
                                  setNotes({
                                    ...notes,
                                    [request.id]: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <div className="business-admin-actions">
                              <button
                                className="business-admin-button"
                                disabled={busy || loading}
                                type="button"
                                onClick={() =>
                                  action({
                                    action: "review_request",
                                    id: request.id,
                                    version: request.version,
                                    decision: "approved",
                                    note: note(request.id),
                                  })
                                }
                              >
                                <Check size={17} />
                                {es ? "Aprobar solicitud" : "Approve request"}
                              </button>
                              <button
                                className="business-admin-button business-admin-secondary"
                                disabled={
                                  busy ||
                                  loading ||
                                  note(request.id).trim().length < 5
                                }
                                type="button"
                                onClick={() =>
                                  action({
                                    action: "review_request",
                                    id: request.id,
                                    version: request.version,
                                    decision: "changes",
                                    note: note(request.id),
                                  })
                                }
                              >
                                {es ? "Solicitar cambios" : "Request changes"}
                              </button>
                            </div>
                          </>
                        ) : (
                          request.review_note && <p>{request.review_note}</p>
                        )}
                      </section>
                    ))}
            </div>
            {data[tab].length === 0 && (
              <section className="business-admin-empty">
                <ClipboardCheck size={30} />
                <h2>{es ? "Todo al día" : "All up to date"}</h2>
                <p>
                  {es
                    ? "Los nuevos registros aparecerán aquí."
                    : "New records will appear here."}
                </p>
              </section>
            )}
          </>
        )}
      </div>
    </OperationsShell>
  );
}
