"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Building2,
  Check,
  ClipboardCheck,
  Plus,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { OperationsShell } from "./operations-shell";
import type { Locale } from "@/lib/i18n";
import {
  businessMessage,
  roleLabel,
} from "@/components/portal/portal-business-copy";
type Company = {
  id: string;
  name: string;
  status: "active" | "suspended";
  members: number;
};
type OrderRequest = {
  id: string;
  company_name: string;
  trip_name: string;
  departure: string;
  returning: string;
  travelers: number;
  mode: string;
  plan_id: string;
  plan_name: string;
  quantity: number;
  version: number;
  status: "pending" | "approved" | "changes";
  review_note: string | null;
};
type Snapshot = { companies: Company[]; requests: OrderRequest[] };
export function CompaniesAdmin({ locale }: { locale: Locale }) {
  const es = locale === "es";
  const [data, setData] = useState<Snapshot | null>(null),
    [tab, setTab] = useState<"companies" | "requests">("companies"),
    [notes, setNotes] = useState<Record<string, string>>({}),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const attempt = useRef<string | null>(null);
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
    if (busy || loading) return false;
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
      return true;
    } catch (value) {
      setError(
        businessMessage(
          value instanceof Error ? value.message : "unavailable",
          locale,
        ),
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget,
      values = new FormData(form);
    attempt.current ??= crypto.randomUUID();
    if (
      await action({
        action: "create_company",
        id: attempt.current,
        name: String(values.get("name")).trim(),
        email: String(values.get("email")).trim(),
      })
    ) {
      attempt.current = null;
      form.reset();
    }
  }
  async function addMember(
    event: FormEvent<HTMLFormElement>,
    companyId: string,
  ) {
    event.preventDefault();
    const form = event.currentTarget,
      values = new FormData(form);
    if (
      await action({
        action: "add_member",
        companyId,
        email: String(values.get("email")).trim(),
        role: String(values.get("role")),
      })
    )
      form.reset();
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
                ? "Crea las empresas y habilita sus accesos exclusivamente desde administración."
                : "Create companies and enable their access exclusively from administration."}
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
              ? "No hay registro ni solicitudes de alta públicas. Los accesos se asignan a cuentas MyTripSim verificadas. Esta fase no cobra ni emite eSIM."
              : "There is no public signup or company application. Access is assigned to verified MyTripSim accounts. This phase does not charge or issue eSIMs."}
          </p>
        </div>
        <nav
          className="business-admin-tabs"
          aria-label={es ? "Gestión de empresas" : "Business management"}
        >
          {(
            [
              {
                key: "companies",
                label: es ? "Empresas" : "Companies",
                icon: Building2,
              },
              {
                key: "requests",
                label: es ? "Solicitudes de eSIM" : "eSIM requests",
                icon: ClipboardCheck,
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
        {tab === "companies" && (
          <form
            className="business-admin-card business-admin-create"
            onSubmit={create}
          >
            <h2>{es ? "Crear empresa" : "Create company"}</h2>
            <p>
              {es
                ? "Indica el correo de una cuenta MyTripSim existente y verificada. Se le asignará el rol de propietario sin cambiar su contraseña."
                : "Enter the email of an existing verified MyTripSim account. It will receive the owner role without changing its password."}
            </p>
            <label>
              {es ? "Nombre de la empresa" : "Company name"}
              <input
                name="name"
                required
                maxLength={120}
                autoComplete="organization"
              />
            </label>
            <label>
              {es ? "Correo del propietario" : "Owner email"}
              <input name="email" required type="email" maxLength={254} />
            </label>
            <button
              type="submit"
              className="business-admin-button"
              disabled={busy || loading}
            >
              <Plus size={17} />
              {es
                ? "Crear empresa y habilitar acceso"
                : "Create company and enable access"}
            </button>
          </form>
        )}
        {data && (
          <>
            <p className="business-admin-limit">
              {es
                ? "Hasta 200 solicitudes recientes y 500 empresas."
                : "Up to 200 recent requests and 500 companies."}
            </p>
            <div className="business-admin-list">
              {tab === "companies"
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
                      {company.status === "active" && (
                        <form
                          onSubmit={(event) => addMember(event, company.id)}
                        >
                          <h3>
                            {es
                              ? "Habilitar acceso empresarial"
                              : "Enable business access"}
                          </h3>
                          <label>
                            {es
                              ? "Correo de cuenta verificada"
                              : "Verified account email"}
                            <input
                              type="email"
                              name="email"
                              required
                              maxLength={254}
                            />
                          </label>
                          <label>
                            {es ? "Rol" : "Role"}
                            <select name="role" defaultValue="coordinator">
                              {["owner", "coordinator", "finance"].map(
                                (role) => (
                                  <option key={role} value={role}>
                                    {roleLabel(role, locale)}
                                  </option>
                                ),
                              )}
                            </select>
                          </label>
                          <button
                            className="business-admin-button"
                            type="submit"
                            disabled={busy || loading}
                          >
                            {es ? "Habilitar acceso" : "Enable access"}
                          </button>
                        </form>
                      )}
                      <label>
                        {es
                          ? "Motivo para suspender o restablecer"
                          : "Reason to suspend or restore"}
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
                            {request.travelers} {es ? "viajeros" : "travelers"}{" "}
                            · {request.quantity} eSIM
                          </dd>
                        </div>
                        <div>
                          <dt>{es ? "Fechas" : "Dates"}</dt>
                          <dd>
                            {request.departure} → {request.returning}
                          </dd>
                        </div>
                      </dl>
                      {request.status === "pending" ? (
                        <>
                          <label>
                            {es
                              ? "Nota visible para la empresa"
                              : "Note visible to the company"}
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
              </section>
            )}
          </>
        )}
      </div>
    </OperationsShell>
  );
}
