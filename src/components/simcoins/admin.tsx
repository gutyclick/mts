"use client";
import { useRef, useState, type FormEvent } from "react";
import { RefreshCw, ShieldCheck } from "lucide-react";
import { SimcoinIcon } from "./art";
import { OperationsShell } from "@/components/admin/operations-shell";
import type { Locale } from "@/lib/i18n";

type Row = Record<string, unknown>;
export type SimcoinsAdminView = {
  configured: boolean;
  enabled: boolean;
  snapshot: Row | null;
  error?: string;
};
const rows = (value: unknown): Row[] =>
  Array.isArray(value)
    ? value.filter(
        (row): row is Row =>
          row !== null && typeof row === "object" && !Array.isArray(row),
      )
    : [];
const text = (value: unknown) =>
  value == null
    ? "—"
    : typeof value === "boolean"
      ? value
        ? "✓"
        : "—"
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
const settingsFields = [
  [
    "release_delay_seconds",
    "Espera tras entrega (segundos)",
    "Delay after delivery (seconds)",
    0,
    31536000,
  ],
  [
    "costs_max_age_seconds",
    "Antigüedad máxima del costo (segundos)",
    "Maximum cost age (seconds)",
    60,
    604800,
  ],
  [
    "max_redeem_bps",
    "Canje máximo (puntos básicos)",
    "Maximum redemption (basis points)",
    0,
    500,
  ],
  [
    "min_contribution_bps",
    "Contribución mínima (puntos básicos)",
    "Minimum contribution (basis points)",
    2000,
    10000,
  ],
  [
    "stripe_bps",
    "Presupuesto Stripe USD (puntos básicos)",
    "Stripe USD budget (basis points)",
    440,
    10000,
  ],
  [
    "stripe_fx_bps",
    "Presupuesto Stripe otras monedas (puntos básicos)",
    "Stripe foreign currency budget (basis points)",
    540,
    10000,
  ],
  [
    "fixed_fee_units",
    "Comisión fija (unidades de USD 0,0001)",
    "Fixed fee (USD 0.0001 units)",
    3000,
    99999999,
  ],
  [
    "affiliate_bps",
    "Reserva de afiliados (puntos básicos)",
    "Affiliate allowance (basis points)",
    800,
    10000,
  ],
  [
    "max_promotion_bps",
    "Promoción máxima (puntos básicos)",
    "Maximum promotion (basis points)",
    0,
    500,
  ],
  [
    "other_variable_units",
    "Otros costos (unidades de USD 0,0001)",
    "Other costs (USD 0.0001 units)",
    0,
    99999999,
  ],
] as const;
const flagFields = [
  "enabled",
  "earn_enabled",
  "redeem_enabled",
  "admin_enabled",
  "public_enabled",
] as const;
const flagLabels = {
  es: ["Programa", "Acumulación", "Canje", "Administración", "Página pública"],
  en: ["Program", "Earning", "Redemption", "Administration", "Public page"],
};

function DataTable({
  data,
  columns,
  empty,
}: {
  data: Row[];
  columns: [string, string][];
  empty: string;
}) {
  return data.length ? (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: 12,
          textAlign: "left",
        }}
      >
        <thead>
          <tr>
            {columns.map(([key, label]) => (
              <th
                key={key}
                style={{
                  padding: 12,
                  borderBottom: "1px solid #dfe8f4",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr
              key={text(
                row.id ?? row.request_id ?? row.user_id ?? row.plan_id ?? index,
              )}
            >
              {columns.map(([key]) => (
                <td
                  key={key}
                  style={{
                    padding: 12,
                    borderBottom: "1px solid #edf1f7",
                    maxWidth: 360,
                    overflowWrap: "anywhere",
                  }}
                >
                  {text(row[key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <p className="operations-footnote">{empty}</p>
  );
}

export function SimcoinsAdmin({
  locale,
  initialData,
}: {
  locale: Locale;
  initialData: SimcoinsAdminView;
}) {
  const es = locale === "es",
    t = (spanish: string, english: string) => (es ? spanish : english);
  const [data, setData] = useState(initialData),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState("");
  const requestIds = useRef(new Map<string, string>());
  const snapshot = data.snapshot ?? {},
    settings = (
      snapshot.settings && typeof snapshot.settings === "object"
        ? snapshot.settings
        : {}
    ) as Row;
  const disabled = busy || !data.enabled || !data.configured;
  async function refresh() {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/simcoins", {
        cache: "no-store",
      });
      if (!response.ok) throw Error();
      setData(await response.json());
    } catch {
      setNotice(
        t(
          "No se pudo cargar SimCoins. Intenta actualizar de nuevo.",
          "SimCoins could not be loaded. Try refreshing again.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>, action: string) {
    event.preventDefault();
    if (disabled) return;
    const form = event.currentTarget,
      fields = new FormData(form),
      reason = String(fields.get("reason") ?? "").trim();
    let body: Row = { action, reason };
    if (action === "adjust")
      body = {
        ...body,
        user: fields.get("user"),
        coins: Number(fields.get("coins")),
      };
    else if (action === "product")
      body.value = {
        plan_id: fields.get("plan_id"),
        earn_enabled: fields.get("earn_enabled") === "on",
        redeem_enabled: fields.get("redeem_enabled") === "on",
      };
    else if (action === "level")
      body.value = {
        id: fields.get("id"),
        name: fields.get("name"),
        rate_bps: Number(fields.get("rate_bps")),
        threshold_cents: Number(fields.get("threshold_cents")),
      };
    else {
      const value: Row = {};
      for (const [key] of settingsFields)
        if (fields.has(key)) value[key] = Number(fields.get(key));
      for (const key of flagFields) value[key] = fields.get(key) === "on";
      body.value = value;
    }
    const signature = JSON.stringify(body);
    let request = requestIds.current.get(signature);
    if (!request) {
      request = crypto.randomUUID();
      requestIds.current.set(signature, request);
    }
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/simcoins", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...body, request }),
      });
      const result = await response.json();
      if (!response.ok) throw Error(result.error ?? "unavailable");
      const latest = await fetch("/api/admin/simcoins", { cache: "no-store" });
      if (latest.ok) setData(await latest.json());
      setNotice(
        t(
          "Cambio registrado en el historial de auditoría.",
          "Change recorded in the audit history.",
        ),
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : "unavailable";
      setNotice(
        code === "mfa_required"
          ? t(
              "Verifica tu autenticador antes de continuar.",
              "Verify your authenticator before continuing.",
            )
          : code === "disabled"
            ? t(
                "Las operaciones de SimCoins están desactivadas.",
                "SimCoins operations are disabled.",
              )
            : t(
                "No se confirmó el cambio. Puedes reintentar; se conservará la misma referencia de solicitud.",
                "The change was not confirmed. You can retry; the same request reference will be kept.",
              ),
      );
    } finally {
      setBusy(false);
    }
  }
  const reason = (
    <label style={{ display: "grid", gap: 7, margin: "15px 0" }}>
      {t(
        "Motivo obligatorio (10–1000 caracteres)",
        "Required reason (10–1000 characters)",
      )}
      <textarea
        name="reason"
        required
        minLength={10}
        maxLength={1000}
        rows={3}
        style={{
          width: "100%",
          padding: 10,
          border: "1px solid #cad9e9",
          borderRadius: 9,
        }}
      />
    </label>
  );
  const save = (
    <button className="button button-primary" type="submit" disabled={disabled}>
      {busy
        ? t("Guardando…", "Saving…")
        : t("Guardar con auditoría", "Save with audit record")}
    </button>
  );
  const empty = t(
    "No hay registros para mostrar.",
    "There are no records to show.",
  );
  const inputStyle = {
    padding: 10,
    border: "1px solid #cad9e9",
    borderRadius: 9,
    width: "100%",
  };
  const panelStyle = { marginBottom: 20 };
  const aggregate =
    snapshot.aggregate && typeof snapshot.aggregate === "object"
      ? (snapshot.aggregate as Row)
      : {};
  const accounts = rows(snapshot.accounts).map((account) => {
    const spend = Math.max(0, Number(account.eligible_spend_cents ?? 0));
    const level = rows(snapshot.levels)
      .filter((item) => Number(item.threshold_cents) <= spend)
      .sort((a, b) => Number(b.threshold_cents) - Number(a.threshold_cents))[0];
    return {
      ...account,
      debt_coins: Math.max(0, -Number(account.available_coins ?? 0)),
      level: level?.name ?? "Traveler",
    };
  });
  return (
    <OperationsShell locale={locale}>
      <header className="operations-heading">
        <div>
          <p className="eyebrow">{t("ADMINISTRACIÓN", "ADMINISTRATION")}</p>
          <h1>SimCoins</h1>
          <p>
            {t(
              "Saldos, niveles, elegibilidad y ajustes auditados.",
              "Balances, levels, eligibility and audited adjustments.",
            )}
          </p>
        </div>
        <button
          className="button button-secondary"
          onClick={refresh}
          disabled={busy}
        >
          <RefreshCw size={16} />
          {t("Actualizar", "Refresh")}
        </button>
      </header>
      <div className="operations-policy">
        <ShieldCheck size={23} />
        <div>
          <strong>
            {data.enabled
              ? t("Administración habilitada", "Administration enabled")
              : t("Operaciones desactivadas", "Operations disabled")}
          </strong>
          <p>
            {t(
              "Cada cambio requiere autenticación MFA, un motivo y una referencia única. El historial financiero no se puede editar.",
              "Every change requires MFA authentication, a reason and a unique reference. Financial history cannot be edited.",
            )}
          </p>
          {!data.configured && !data.error && (
            <p>
              {t(
                "El almacenamiento de SimCoins no está habilitado. No se han consultado datos financieros.",
                "SimCoins storage is not enabled. Financial data has not been queried.",
              )}
            </p>
          )}
        </div>
      </div>
      {(notice || data.error) && (
        <p role="status" className="operations-policy">
          {notice ||
            t(
              "No se pudieron cargar los datos de SimCoins.",
              "SimCoins data could not be loaded.",
            )}
        </p>
      )}
      <div className="operations-stats">
        {[
          ["availableCoins", t("Monedas disponibles", "Available coins")],
          ["pendingCoins", t("Monedas pendientes", "Pending coins")],
          ["reservedCoins", t("Monedas reservadas", "Reserved coins")],
          ["debtCoins", t("Deuda por compensar", "Debt to cover")],
          ["earnedCoins", t("Monedas ganadas", "Earned coins")],
          ["redeemedCoins", t("Monedas canjeadas", "Redeemed coins")],
        ].map(([key, label]) => (
          <article key={key}>
            <SimcoinIcon size={24} />
            <p>{label}</p>
            <strong>{data.configured ? text(aggregate[key]) : "—"}</strong>
            <small>
              {t(
                "100 SimCoins = USD 1 de crédito promocional",
                "100 SimCoins = USD 1 promotional credit",
              )}
            </small>
          </article>
        ))}
      </div>
      <section className="admin-panel" style={panelStyle}>
        <h2>{t("Participantes y saldos", "Participants and balances")}</h2>
        <DataTable
          data={accounts}
          empty={empty}
          columns={[
            ["user_id", t("Usuario", "User")],
            ["available_coins", t("Disponible", "Available")],
            ["pending_coins", t("Pendiente", "Pending")],
            ["reserved_coins", t("Reservado", "Reserved")],
            ["debt_coins", t("Deuda", "Debt")],
            [
              "eligible_spend_cents",
              t(
                "Gasto elegible (centavos USD)",
                "Eligible spending (USD cents)",
              ),
            ],
            ["level", t("Nivel", "Level")],
          ]}
        />
      </section>
      <section className="admin-panel" style={panelStyle}>
        <h2>{t("Movimientos recientes", "Recent transactions")}</h2>
        <DataTable
          data={rows(snapshot.transactions)}
          empty={empty}
          columns={[
            ["created_at", t("Fecha", "Date")],
            ["user_id", t("Usuario", "User")],
            ["kind", t("Movimiento", "Activity")],
            ["bucket", t("Saldo", "Balance")],
            ["coin_delta", "SimCoins"],
            ["order_id", t("Pedido", "Order")],
          ]}
        />
      </section>
      <section className="admin-panel" style={panelStyle}>
        <h2>
          {t("Ajuste autorizado de saldo", "Authorized balance adjustment")}
        </h2>
        <p className="operations-footnote">
          {t(
            "Registra un abono o débito nuevo, sin modificar movimientos anteriores. Las cantidades son monedas enteras.",
            "Record a new credit or debit without changing previous transactions. Amounts are whole coins.",
          )}
        </p>
        <form onSubmit={(event) => submit(event, "adjust")}>
          <fieldset disabled={disabled} style={{ border: 0, padding: 0 }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))",
                gap: 15,
              }}
            >
              <label>
                {t("ID de usuario (UUID)", "User ID (UUID)")}
                <input
                  name="user"
                  required
                  pattern="[0-9a-fA-F-]{36}"
                  style={inputStyle}
                />
              </label>
              <label>
                {t("Monedas (+/−)", "Coins (+/−)")}
                <input
                  name="coins"
                  type="number"
                  step="1"
                  required
                  min={-99999999}
                  max={99999999}
                  style={inputStyle}
                />
              </label>
            </div>
            {reason}
            {save}
          </fieldset>
        </form>
      </section>
      <section className="admin-panel" style={panelStyle}>
        <h2>{t("Configuración del programa", "Program settings")}</h2>
        <p className="operations-footnote">
          {t(
            "100 puntos básicos = 1%. Los interruptores del entorno también deben estar habilitados para operar.",
            "100 basis points = 1%. Environment switches must also be enabled for operations.",
          )}
        </p>
        <form
          key={text(settings.updated_at)}
          onSubmit={(event) => submit(event, "settings")}
        >
          <fieldset disabled={disabled} style={{ border: 0, padding: 0 }}>
            <div
              style={{
                display: "flex",
                gap: 20,
                flexWrap: "wrap",
                margin: "15px 0",
              }}
            >
              {flagFields.map((key, i) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    name={key}
                    defaultChecked={settings[key] === true}
                  />{" "}
                  {flagLabels[locale][i]}
                </label>
              ))}
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
                gap: 18,
              }}
            >
              {settingsFields
                .filter(([key]) => typeof settings[key] === "number")
                .map(([key, spanish, english, min, max]) => (
                  <label key={key}>
                    {t(spanish, english)}
                    <input
                      style={inputStyle}
                      name={key}
                      type="number"
                      step="1"
                      min={min}
                      max={max}
                      required
                      defaultValue={Number(settings[key])}
                    />
                  </label>
                ))}
            </div>
            {reason}
            {save}
          </fieldset>
        </form>
      </section>
      <section className="admin-panel" style={panelStyle}>
        <h2>{t("Niveles", "Levels")}</h2>
        {rows(snapshot.levels).map((level) => (
          <form
            key={text(level.id) + text(settings.updated_at)}
            onSubmit={(event) => submit(event, "level")}
            style={{ padding: "20px 0", borderBottom: "1px solid #dfe8f4" }}
          >
            <fieldset disabled={disabled} style={{ border: 0, padding: 0 }}>
              <strong>{text(level.id)}</strong>
              <input name="id" type="hidden" value={text(level.id)} />
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                  gap: 15,
                  marginTop: 12,
                }}
              >
                <label>
                  {t("Nombre", "Name")}
                  <input
                    name="name"
                    required
                    maxLength={80}
                    defaultValue={text(level.name)}
                    style={inputStyle}
                  />
                </label>
                <label>
                  {t("Tasa (puntos básicos)", "Rate (basis points)")}
                  <input
                    name="rate_bps"
                    type="number"
                    step="1"
                    min={0}
                    max={600}
                    required
                    defaultValue={Number(level.rate_bps)}
                    readOnly={level.id === "traveler"}
                    style={inputStyle}
                  />
                </label>
                <label>
                  {t("Umbral (centavos USD)", "Threshold (USD cents)")}
                  <input
                    name="threshold_cents"
                    type="number"
                    step="1"
                    min={0}
                    max={100000000}
                    required
                    defaultValue={Number(level.threshold_cents)}
                    readOnly={
                      level.id === "traveler" || level.id === "explorer"
                    }
                    style={inputStyle}
                  />
                </label>
              </div>
              {reason}
              {save}
            </fieldset>
          </form>
        ))}
      </section>
      <section className="admin-panel" style={panelStyle}>
        <h2>{t("Elegibilidad de productos", "Product eligibility")}</h2>
        <DataTable
          data={rows(snapshot.products)}
          empty={empty}
          columns={[
            ["plan_id", t("Plan", "Plan")],
            ["earn_enabled", t("Acumulación", "Earning")],
            ["redeem_enabled", t("Canje", "Redemption")],
          ]}
        />
        <form
          onSubmit={(event) => submit(event, "product")}
          style={{ marginTop: 20 }}
        >
          <fieldset disabled={disabled} style={{ border: 0, padding: 0 }}>
            <label>
              {t("ID del plan", "Plan ID")}
              <input
                name="plan_id"
                required
                maxLength={200}
                style={inputStyle}
              />
            </label>
            <div style={{ display: "flex", gap: 20, margin: "15px 0" }}>
              <label>
                <input name="earn_enabled" type="checkbox" />{" "}
                {t("Acumulación", "Earning")}
              </label>
              <label>
                <input name="redeem_enabled" type="checkbox" />{" "}
                {t("Canje", "Redemption")}
              </label>
            </div>
            {reason}
            {save}
          </fieldset>
        </form>
      </section>
      <section className="admin-panel" style={panelStyle}>
        <h2>{t("Historial de auditoría", "Audit history")}</h2>
        <DataTable
          data={rows(snapshot.audit)}
          empty={empty}
          columns={[
            ["created_at", t("Fecha", "Date")],
            ["actor", t("Administrador", "Administrator")],
            ["action", t("Acción", "Action")],
            ["reason", t("Motivo", "Reason")],
            ["target_user", t("Usuario", "User")],
            ["request_id", t("Solicitud", "Request")],
          ]}
        />
      </section>
      <section className="admin-panel">
        <h2>{t("Incidencias de operaciones", "Operation issues")}</h2>
        <DataTable
          data={rows(snapshot.errors)}
          empty={t("No hay incidencias registradas.", "No issues recorded.")}
          columns={[
            ["created_at", t("Fecha", "Date")],
            ["order_id", t("Pedido", "Order")],
            ["code", t("Código", "Code")],
          ]}
        />
      </section>
    </OperationsShell>
  );
}
