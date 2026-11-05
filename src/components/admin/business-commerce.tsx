"use client";
import { useEffect, useState, type FormEvent } from "react";
import { OperationsShell } from "./operations-shell";
import { destinations } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n";
import { businessMessage } from "@/components/portal/portal-business-copy";

type Settings = {
  bank_enabled: boolean;
  bank_instructions: string;
  stripe_enabled: boolean;
  yappy_enabled: boolean;
  yappy_fee_bps: number | null;
  yappy_fixed_cents: number;
  other_reserve_cents: number;
  issuance_enabled: boolean;
};
type Order = {
  id: string;
  company_name: string;
  trip_name: string;
  plan_name: string;
  quantity: number;
  total_cents: number;
  state: string;
  paid_at: string | null;
  ready_units: number;
  issued_units: number;
};
type Snapshot = {
  settings: Settings;
  readiness: { stripe: boolean; yappy: boolean; issuance: boolean };
  companies: { id: string; name: string }[];
  tariffs: {
    id: string;
    plan_name: string;
    company_id: string | null;
    unit_cents: number;
    active: boolean;
  }[];
  requests: {
    id: string;
    company_name: string;
    trip_name: string;
    plan_name: string;
    quantity: number;
    status: string;
    version: number;
  }[];
  orders: Order[];
};
const money = (cents: number, locale: Locale) =>
  new Intl.NumberFormat(locale, { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
function cents(value: FormDataEntryValue | null, whole = false) {
  const text = String(value ?? "").trim();
  if (!(whole ? /^\d+$/ : /^\d+(?:\.\d{1,2})?$/).test(text))
    throw Error("invalid");
  const [a, b = ""] = text.split(".");
  const amount = Number(a) * 100 + Number(b.padEnd(2, "0"));
  if (!Number.isSafeInteger(amount)) throw Error("invalid");
  return amount;
}
export function BusinessCommerceAdmin({ locale }: { locale: Locale }) {
  const es = locale === "es",
    t = (a: string, b: string) => (es ? a : b);
  const [data, setData] = useState<Snapshot | null>(null),
    [tab, setTab] = useState("orders"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [revision, setRevision] = useState(0),
    [destination, setDestination] = useState(""),
    [plans, setPlans] = useState<{ id: string; name: string }[]>([]);
  const message = (code: string) =>
    /margin|below_cost|insufficient_reserve/.test(code)
      ? t(
          "El precio no cubre el costo y las reservas. Revisa la tarifa y las comisiones.",
          "The price does not cover cost and reserves. Review the rate and fees.",
        )
      : businessMessage(code, locale);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/business-commerce", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (r) => {
        const value = await r.json();
        if (!r.ok) throw Error(value.error ?? "unavailable");
        setData(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e.message));
      });
    return () => controller.abort(); /* locale determines messages */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, locale]);
  useEffect(() => {
    if (!destination) return;
    const controller = new AbortController();
    fetch(
      `/api/admin/business-commerce?destination=${encodeURIComponent(destination)}`,
      { signal: controller.signal, cache: "no-store" },
    )
      .then(async (r) => {
        const value = await r.json();
        if (!r.ok) throw Error(value.error);
        setPlans(value.plans);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(message(e.message));
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destination, locale]);
  async function submit(
    event: FormEvent<HTMLFormElement>,
    build: (form: FormData) => unknown,
  ) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const body = build(new FormData(event.currentTarget));
      const response = await fetch("/api/admin/business-commerce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const value = await response.json();
      if (!response.ok) throw Error(value.error ?? "unavailable");
      setNotice(t("Operación completada.", "Action completed."));
      setRevision((v) => v + 1);
    } catch (e) {
      setError(message(e instanceof Error ? e.message : "unavailable"));
    } finally {
      setBusy(false);
    }
  }
  return (
    <OperationsShell locale={locale}>
      <main className="bc-workspace">
        <header>
          <p className="bc-eyebrow">B2B · USD</p>
          <h1>{t("Comercio empresarial", "Business commerce")}</h1>
          <p>
            {t(
              "Cotizaciones, cobros y entrega de eSIM para empresas.",
              "Company quotes, payments and eSIM delivery.",
            )}
          </p>
        </header>
        <nav className="bc-tabs" aria-label={t("Comercio", "Commerce")}>
          {[
            ["orders", t("Pedidos", "Orders")],
            ["rates", t("Tarifas", "Rates")],
            ["settings", t("Configuración de pagos", "Payment settings")],
          ].map(([id, label]) => (
            <button
              key={id}
              aria-pressed={tab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        {error && (
          <p role="alert" className="bc-error">
            {error}
          </p>
        )}
        {notice && <p role="status">{notice}</p>}
        {!data ? (
          <p>{t("Cargando…", "Loading…")}</p>
        ) : (
          <fieldset disabled={busy} className="bc-content">
            {tab === "orders" && (
              <>
                <h2>
                  {t("Solicitudes y cotizaciones", "Requests and quotes")}
                </h2>
                {!data.requests.length && (
                  <p>{t("No hay solicitudes.", "No requests.")}</p>
                )}
                {data.requests.map((request) => (
                  <article className="bc-card" key={request.id}>
                    <h3>
                      {request.company_name} · {request.trip_name}
                    </h3>
                    <p>
                      {request.plan_name} × {request.quantity} ·{" "}
                      {request.status}
                    </p>
                    <form
                      className="bc-form"
                      onSubmit={(e) =>
                        submit(e, (f) => ({
                          action: "publish_quote",
                          requestId: request.id,
                          version: request.version,
                          ...(f.get("price")
                            ? { unitCents: cents(f.get("price"), true) }
                            : {}),
                          taxCents: cents(f.get("tax")),
                          validHours: Number(f.get("hours")),
                        }))
                      }
                    >
                      <label>
                        {t(
                          "Precio unitario USD (entero, opcional)",
                          "Unit price USD (whole dollars, optional)",
                        )}
                        <input
                          name="price"
                          inputMode="numeric"
                          pattern="[0-9]+"
                        />
                      </label>
                      <label>
                        {t("Impuesto USD", "Tax USD")}
                        <input
                          name="tax"
                          required
                          inputMode="decimal"
                          placeholder="0.00"
                          defaultValue="0.00"
                        />
                      </label>
                      <label>
                        {t("Validez en horas", "Validity in hours")}
                        <input
                          name="hours"
                          required
                          type="number"
                          min="1"
                          max="168"
                          defaultValue="168"
                        />
                      </label>
                      <button>
                        {t("Publicar cotización", "Publish quote")}
                      </button>
                    </form>
                  </article>
                ))}
                <h2>{t("Pedidos", "Orders")}</h2>
                {!data.orders.length && (
                  <p>{t("No hay pedidos.", "No orders.")}</p>
                )}
                {data.orders.map((order) => (
                  <article className="bc-card" key={order.id}>
                    <h3>
                      {order.company_name} · {order.trip_name}
                    </h3>
                    <p>
                      {order.plan_name} × {order.quantity} ·{" "}
                      <strong>{money(order.total_cents, locale)}</strong> ·{" "}
                      {order.state}
                    </p>
                    <p>
                      {t("Emitidas", "Issued")}: {order.issued_units}/
                      {order.quantity} · {t("Listas", "Ready")}:{" "}
                      {order.ready_units}/{order.quantity}
                    </p>
                    {!order.paid_at && order.state === "awaiting_payment" && (
                      <form
                        className="bc-form"
                        onSubmit={(e) =>
                          submit(e, (f) => ({
                            action: "confirm_transfer",
                            orderId: order.id,
                            reference: String(f.get("reference")),
                            amountCents: cents(f.get("amount")),
                          }))
                        }
                      >
                        <label>
                          {t("Referencia bancaria", "Bank reference")}
                          <input name="reference" required maxLength={200} />
                        </label>
                        <label>
                          {t("Monto recibido USD", "Amount received USD")}
                          <input name="amount" required inputMode="decimal" />
                        </label>
                        <button>
                          {t(
                            "Confirmar transferencia recibida",
                            "Confirm received transfer",
                          )}
                        </button>
                      </form>
                    )}
                    <div className="bc-actions">
                      {order.paid_at && order.state === "awaiting_release" && (
                        <form
                          onSubmit={(e) =>
                            submit(e, () => ({
                              action: "release",
                              orderId: order.id,
                            }))
                          }
                        >
                          <button disabled={!data.readiness.issuance}>
                            {t(
                              "Autorizar emisión de eSIM",
                              "Authorize eSIM issuance",
                            )}
                          </button>
                        </form>
                      )}
                      {order.state === 'ready' && order.ready_units === order.quantity && (
                        <form
                          onSubmit={(e) =>
                            submit(e, () => ({
                              action: "notify",
                              orderId: order.id,
                            }))
                          }
                        >
                          <button>
                            {t("Notificar entrega", "Notify delivery")}
                          </button>
                        </form>
                      )}
                    </div>
                  </article>
                ))}
              </>
            )}
            {tab === "rates" && (
              <>
                <h2>{t("Tarifas por plan", "Plan rates")}</h2>
                <form
                  className="bc-form bc-card"
                  onSubmit={(e) =>
                    submit(e, (f) => ({
                      action: "save_tariff",
                      planId: String(f.get("plan")),
                      companyId: f.get("company") || null,
                      unitCents: cents(f.get("price"), true),
                      active: f.get("active") === "on",
                    }))
                  }
                >
                  <label>
                    {t("Destino", "Destination")}
                    <select
                      required
                      value={destination}
                      onChange={(e) => {
                        setDestination(e.target.value);
                        setPlans([]);
                      }}
                    >
                      <option value="">{t("Elegir", "Choose")}</option>
                      {destinations.map((d) => (
                        <option key={d.slug} value={d.slug}>
                          {d.name[locale]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("Plan", "Plan")}
                    <select name="plan" required key={destination}>
                      <option value="">{t("Elegir", "Choose")}</option>
                      {plans.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("Empresa", "Company")}
                    <select name="company">
                      <option value="">
                        {t("Todas (tarifa general)", "All (general rate)")}
                      </option>
                      {data.companies.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("Precio USD entero", "Whole-dollar USD price")}
                    <input
                      name="price"
                      required
                      inputMode="numeric"
                      pattern="[0-9]+"
                    />
                  </label>
                  <label className="bc-check">
                    <input type="checkbox" name="active" defaultChecked />
                    {t("Activa", "Active")}
                  </label>
                  <button>{t("Guardar tarifa", "Save rate")}</button>
                </form>
                {data.tariffs.map((rate) => (
                  <article className="bc-card" key={rate.id}>
                    <strong>{rate.plan_name}</strong>
                    <p>
                      {data.companies.find((c) => c.id === rate.company_id)
                        ?.name ?? t("Tarifa general", "General rate")}{" "}
                      · {money(rate.unit_cents, locale)} ·{" "}
                      {rate.active
                        ? t("Activa", "Active")
                        : t("Inactiva", "Inactive")}
                    </p>
                  </article>
                ))}
              </>
            )}
            {tab === "settings" && (
              <form
                className="bc-card bc-form"
                key={revision}
                onSubmit={(e) =>
                  submit(e, (f) => ({
                    action: "save_settings",
                    value: {
                      bank_enabled: f.get("bank") === "on",
                      bank_instructions: String(f.get("instructions")),
                      stripe_enabled: f.get("stripe") === "on",
                      yappy_enabled: f.get("yappy") === "on",
                      yappy_fee_bps:
                        f.get("fee") === "" ? null : Number(f.get("fee")),
                      yappy_fixed_cents: cents(f.get("fixed")),
                      other_reserve_cents: cents(f.get("reserve")),
                      issuance_enabled: f.get("issuance") === "on",
                    },
                  }))
                }
              >
                <h2>{t("Métodos y reservas", "Methods and reserves")}</h2>
                <p>
                  {t(
                    "La disponibilidad depende de la configuración verificada del servidor.",
                    "Availability depends on verified server configuration.",
                  )}
                </p>
                {(
                  [
                    [
                      "bank",
                      "bank_enabled",
                      t("Transferencia bancaria", "Bank transfer"),
                    ],
                    ["stripe", "stripe_enabled", "Stripe"],
                    ["yappy", "yappy_enabled", "Yappy"],
                    [
                      "issuance",
                      "issuance_enabled",
                      t("Emisión de eSIM", "eSIM issuance"),
                    ],
                  ] as const
                ).map(([name, key, label]) => (
                  <label className="bc-check" key={name}>
                    <input
                      name={name}
                      type="checkbox"
                      defaultChecked={data.settings[key]}
                    />
                    {label}
                    {name !== "bank" && (
                      <small>
                        {" "}
                        ·{" "}
                        {data.readiness[name]
                          ? t("Configurado", "Configured")
                          : t("Pendiente de configuración", "Setup pending")}
                      </small>
                    )}
                  </label>
                ))}
                <label>
                  {t(
                    "Instrucciones bancarias privadas",
                    "Private bank instructions",
                  )}
                  <textarea
                    name="instructions"
                    rows={5}
                    defaultValue={data.settings.bank_instructions ?? ""}
                  />
                </label>
                <label>
                  {t(
                    "Comisión Yappy en puntos base (vacío: sin verificar)",
                    "Yappy fee in basis points (blank: unverified)",
                  )}
                  <input
                    name="fee"
                    type="number"
                    min="0"
                    max="10000"
                    step="1"
                    defaultValue={data.settings.yappy_fee_bps ?? ""}
                  />
                </label>
                <label>
                  {t("Comisión fija Yappy USD", "Yappy fixed fee USD")}
                  <input
                    name="fixed"
                    required
                    inputMode="decimal"
                    defaultValue={(
                      data.settings.yappy_fixed_cents / 100
                    ).toFixed(2)}
                  />
                </label>
                <label>
                  {t(
                    "Otra reserva por unidad USD",
                    "Other reserve per unit USD",
                  )}
                  <input
                    name="reserve"
                    required
                    inputMode="decimal"
                    defaultValue={(
                      data.settings.other_reserve_cents / 100
                    ).toFixed(2)}
                  />
                </label>
                <p>
                  {t(
                    "Yappy requiere credenciales y verificación en el servidor.",
                    "Yappy requires server credentials and verification.",
                  )}{" "}
                </p>
                <button>{t("Guardar configuración", "Save settings")}</button>
              </form>
            )}
          </fieldset>
        )}
      </main>
    </OperationsShell>
  );
}
