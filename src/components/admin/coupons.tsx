"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  Check,
  Copy,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Shuffle,
  TicketPercent,
  X,
} from "lucide-react";
import { OperationsShell } from "./operations-shell";
import type { Locale } from "@/lib/i18n";
import { formatUSD } from "@/lib/retail-prices";

export type AdminCoupon = {
  id: string;
  code: string;
  name: string;
  kind: "percent" | "fixed";
  value: number;
  starts_at: string | null;
  ends_at: string | null;
  max_uses: number | null;
  max_uses_per_customer: number | null;
  minimum_cents: number;
  active: boolean;
  archived: boolean;
  version: number;
  used: number;
  reserved: number;
};
export type CouponAdminData = {
  coupons: AdminCoupon[];
  insights: Record<
    string,
    {
      paidOrders: number;
      refundExcludedOrders: number;
      refundExcludedSalesUsdCents: number;
      salesUsdCents: number;
      discountUsdCents: number;
      estimatedOrders: number;
      estimatedContributionUsdCents: number | null;
    }
  >;
  summary: {
    active: number;
    scheduled: number;
    redeemed: number;
    discountUsdCents: number;
  };
};
type Filter =
  "all" | "active" | "scheduled" | "expired" | "paused" | "archived";
function status(c: AdminCoupon): Exclude<Filter, "all"> {
  if (c.archived) return "archived";
  if (!c.active) return "paused";
  if (c.ends_at && Date.parse(c.ends_at) <= Date.now()) return "expired";
  if (c.starts_at && Date.parse(c.starts_at) > Date.now()) return "scheduled";
  return "active";
}
const labels = (es: boolean): Record<Filter, string> => ({
  all: es ? "Todos" : "All",
  active: es ? "Activos" : "Active",
  scheduled: es ? "Programados" : "Scheduled",
  expired: es ? "Vencidos" : "Expired",
  paused: es ? "Pausados" : "Paused",
  archived: es ? "Archivados" : "Archived",
});
const localDate = (value: string | null) => {
  if (!value) return "";
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export function CouponsAdmin({ locale }: { locale: Locale }) {
  const es = locale === "es",
    router = useRouter();
  const [data, setData] = useState<CouponAdminData | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0),
    [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editor, setEditor] = useState<AdminCoupon | "new" | null>(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(false);
      try {
        const r = await fetch("/api/admin/coupons", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (r.status === 428) {
          router.replace(`/${locale}/admin/security`);
          return;
        }
        if (!r.ok) throw new Error();
        const result: CouponAdminData = await r.json();
        if (!Array.isArray(result.coupons) || !result.summary)
          throw new Error();
        if (!controller.signal.aborted) setData(result);
      } catch {
        if (!controller.signal.aborted) setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [refresh, locale, router]);
  const visible =
    data?.coupons.filter(
      (c) =>
        (filter === "all" ? !c.archived : status(c) === filter) &&
        `${c.code} ${c.name}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    ) ?? [];
  function date(value: string) {
    return new Date(value).toLocaleString(es ? "es-PA" : "en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }
  return (
    <OperationsShell locale={locale}>
      <main className="coupon-workspace">
        <header className="coupon-heading">
          <div>
            <p className="eyebrow">{es ? "PROMOCIONES" : "PROMOTIONS"}</p>
            <h1>
              <TicketPercent aria-hidden="true" />
              {es ? "Cupones" : "Coupons"}
            </h1>
            <p>
              {es
                ? "Crea una oferta. Elige cuándo y cuántas veces se puede usar."
                : "Create an offer. Choose when and how often it can be used."}
            </p>
          </div>
          <button
            className="button button-primary"
            onClick={() => {
              setNotice("");
              setEditor("new");
            }}
          >
            <Plus size={18} />
            {es ? "Crear cupón" : "Create coupon"}
          </button>
        </header>
        <div
          className="coupon-stats"
          aria-label={es ? "Resumen de cupones" : "Coupon summary"}
        >
          {[
            [es ? "Activos" : "Active", data?.summary.active],
            [es ? "Programados" : "Scheduled", data?.summary.scheduled],
            [
              es ? "Usos completados" : "Completed uses",
              data?.summary.redeemed,
            ],
            [
              es ? "Descuentos aplicados" : "Discounts applied",
              data
                ? formatUSD(data.summary.discountUsdCents, locale)
                : undefined,
            ],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value ?? "—"}</strong>
            </div>
          ))}
        </div>
        {notice && (
          <p className="coupon-notice" role="status">
            {notice}
          </p>
        )}
        <section
          className="coupon-panel"
          aria-label={es ? "Lista de cupones" : "Coupon list"}
        >
          <div className="coupon-toolbar">
            <label className="coupon-search">
              <Search size={18} aria-hidden="true" />
              <input
                aria-label={
                  es ? "Buscar código o nombre" : "Search code or name"
                }
                placeholder={
                  es ? "Buscar código o nombre" : "Search code or name"
                }
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            <label className="coupon-filter">
              <span className="sr-only">{es ? "Estado" : "Status"}</span>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as Filter)}
              >
                {Object.entries(labels(es)).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="coupon-icon"
              onClick={() => setRefresh((v) => v + 1)}
              disabled={loading}
              aria-label={es ? "Actualizar cupones" : "Refresh coupons"}
            >
              <RefreshCw size={18} />
            </button>
          </div>
          {error ? (
            <div className="coupon-empty" role="alert">
              <h2>
                {es
                  ? "No se pudieron cargar los cupones"
                  : "Coupons could not be loaded"}
              </h2>
              <p>
                {es
                  ? "Actualiza para volver a intentarlo."
                  : "Refresh to try again."}
              </p>
            </div>
          ) : loading ? (
            <p className="coupon-empty" role="status">
              {es ? "Cargando cupones…" : "Loading coupons…"}
            </p>
          ) : !visible.length ? (
            <div className="coupon-empty">
              <TicketPercent size={36} />
              <h2>
                {data?.coupons.length
                  ? es
                    ? "No hay coincidencias"
                    : "No matching coupons"
                  : es
                    ? "Tu próxima oferta empieza aquí"
                    : "Your next offer starts here"}
              </h2>
              <p>
                {es
                  ? "Crea un cupón o cambia los filtros para ver otras ofertas."
                  : "Create a coupon or change the filters to see other offers."}
              </p>
            </div>
          ) : (
            <div className="coupon-table-wrap">
              <table className="coupon-table">
                <thead>
                  <tr>
                    {[
                      es ? "Cupón" : "Coupon",
                      es ? "Descuento" : "Discount",
                      es ? "Vigencia" : "Validity",
                      es ? "Uso / límite" : "Uses / limit",
                      es ? "Ventas (referencia USD)" : "Sales (USD reference)",
                      es ? "Contribución estimada" : "Estimated contribution",
                      es ? "Estado" : "Status",
                      es ? "Acciones" : "Actions",
                    ].map((x) => (
                      <th key={x} scope="col">
                        {x}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((c) => (
                    <tr key={c.id}>
                      <td data-label={es ? "Cupón" : "Coupon"}>
                        <strong className="coupon-code">{c.code}</strong>
                        <span className="coupon-secondary">{c.name}</span>
                      </td>
                      <td data-label={es ? "Descuento" : "Discount"}>
                        <strong>
                          {c.kind === "percent"
                            ? `${c.value / 100}%`
                            : formatUSD(c.value, locale)}
                        </strong>
                        <span className="coupon-secondary">
                          {c.minimum_cents
                            ? `${es ? "Mín." : "Min."} ${formatUSD(c.minimum_cents, locale)}`
                            : es
                              ? "Sin mínimo"
                              : "No minimum"}
                        </span>
                      </td>
                      <td data-label={es ? "Vigencia" : "Validity"}>
                        {c.starts_at
                          ? date(c.starts_at)
                          : es
                            ? "Desde publicación"
                            : "From publication"}
                        <span className="coupon-secondary">
                          {c.ends_at
                            ? `${es ? "Hasta" : "Until"} ${date(c.ends_at)}`
                            : es
                              ? "Sin vencimiento"
                              : "No expiry"}
                        </span>
                      </td>
                      <td data-label={es ? "Uso / límite" : "Uses / limit"}>
                        <strong>
                          {c.used} / {c.max_uses ?? "∞"}
                        </strong>
                        <span className="coupon-secondary">
                          {c.reserved} {es ? "reservados" : "reserved"} ·{" "}
                          {c.max_uses_per_customer ?? "∞"}{" "}
                          {es ? "por persona" : "per person"}
                        </span>
                      </td>
                      <td
                        data-label={
                          es
                            ? "Ventas (referencia USD)"
                            : "Sales (USD reference)"
                        }
                      >
                        <strong>
                          {formatUSD(
                            data?.insights?.[c.id]?.salesUsdCents ?? 0,
                            locale,
                          )}
                        </strong>
                        <span className="coupon-secondary">
                          {data?.insights?.[c.id]?.paidOrders ?? 0}{" "}
                          {es ? "pedidos · descuentos" : "orders · discounts"}{" "}
                          {formatUSD(
                            data?.insights?.[c.id]?.discountUsdCents ?? 0,
                            locale,
                          )}
                        </span>
                      </td>
                      <td
                        data-label={
                          es
                            ? "Contribución estimada"
                            : "Estimated contribution"
                        }
                      >
                        <strong>
                          {data?.insights?.[c.id]
                            ?.estimatedContributionUsdCents != null
                            ? formatUSD(
                                data.insights[c.id]
                                  .estimatedContributionUsdCents!,
                                locale,
                              )
                            : "—"}
                        </strong>
                        <span className="coupon-secondary">
                          {data?.insights?.[c.id]?.estimatedOrders ?? 0} /{" "}
                          {data?.insights?.[c.id]?.paidOrders ?? 0}{" "}
                          {es ? "pedidos estimados" : "orders estimated"}
                        </span>
                        {!!data?.insights?.[c.id]?.refundExcludedOrders && (
                          <span className="coupon-secondary">
                            {data.insights[c.id].refundExcludedOrders}{" "}
                            {es
                              ? "excluidos por reembolso"
                              : "excluded for refunds"}{" "}
                            ·{" "}
                            {formatUSD(
                              data.insights[c.id].refundExcludedSalesUsdCents,
                              locale,
                            )}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`coupon-status coupon-status-${status(c)}`}
                        >
                          {labels(es)[status(c)]}
                        </span>
                      </td>
                      <td>
                        <div className="coupon-row-actions">
                          <button
                            className="coupon-icon"
                            aria-label={`${es ? "Copiar" : "Copy"} ${c.code}`}
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(c.code);
                                setNotice(
                                  es ? "Código copiado." : "Code copied.",
                                );
                              } catch {
                                setNotice(
                                  es
                                    ? "No se pudo copiar. Selecciona el código para copiarlo."
                                    : "Could not copy. Select the code to copy it.",
                                );
                              }
                            }}
                          >
                            <Copy size={17} />
                          </button>
                          <button
                            className="coupon-icon"
                            aria-label={`${c.archived ? (es ? "Ver" : "View") : es ? "Editar" : "Edit"} ${c.code}`}
                            onClick={() => setEditor(c)}
                          >
                            <Pencil size={17} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <p className="coupon-footnote">
          {es
            ? "Ventas en USD al precio de compra tras el cupón, solo pedidos pagados en producción. Las métricas por oferta excluyen pedidos con reembolsos solicitados, en curso o completados, incluso parciales. La contribución estimada usa cobros conservadores, costos mayoristas y comisiones guardados al comprar; no es beneficio neto ni conciliación de Stripe. Los descuentos del resumen incluyen todos los usos completados. "
            : "USD sales use checkout prices after the coupon, for paid live orders only. Per-offer metrics exclude orders with requested, ongoing or completed refunds, including partial refunds. Estimated contribution uses conservative receipts, wholesale costs and fees saved at checkout; it is not net profit or Stripe reconciliation. Summary discounts include all completed uses. "}
          {es
            ? "Un cupón por compra. No se combina con SimCoins. Las fechas se muestran en la zona horaria de tu navegador; el cupón deja de ser válido a la hora exacta de vencimiento."
            : "One coupon per purchase. Cannot be combined with SimCoins. Dates use your browser’s time zone; the coupon stops being valid at the exact expiry time."}
        </p>
        {editor && (
          <CouponEditor
            key={typeof editor === "string" ? editor : editor.id}
            coupon={editor === "new" ? null : editor}
            locale={locale}
            close={() => setEditor(null)}
            saved={(archived) => {
              setEditor(null);
              setNotice(
                archived
                  ? es
                    ? "Cupón archivado. Se conserva su historial."
                    : "Coupon archived. Its history is preserved."
                  : es
                    ? "Cupón guardado."
                    : "Coupon saved.",
              );
              setRefresh((v) => v + 1);
            }}
          />
        )}
      </main>
    </OperationsShell>
  );
}

function CouponEditor({
  coupon,
  locale,
  close,
  saved,
}: {
  coupon: AdminCoupon | null;
  locale: Locale;
  close: () => void;
  saved: (archived: boolean) => void;
}) {
  const es = locale === "es",
    router = useRouter(),
    dialog = useRef<HTMLDialogElement>(null);
  const [code, setCode] = useState(coupon?.code ?? ""),
    [name, setName] = useState(coupon?.name ?? "");
  const [kind, setKind] = useState<"percent" | "fixed">(
    coupon?.kind ?? "percent",
  );
  const [value, setValue] = useState(
    coupon ? String(coupon.value / 100) : "10",
  );
  const [starts, setStarts] = useState(localDate(coupon?.starts_at ?? null)),
    [ends, setEnds] = useState(localDate(coupon?.ends_at ?? null));
  const [permanent, setPermanent] = useState(!coupon?.ends_at),
    [active, setActive] = useState(coupon?.active ?? true);
  const [max, setMax] = useState(coupon?.max_uses?.toString() ?? ""),
    [perPerson, setPerPerson] = useState(
      coupon?.max_uses_per_customer?.toString() ?? "",
    );
  const [minimum, setMinimum] = useState(
      String((coupon?.minimum_cents ?? 0) / 100),
    ),
    [subtotal, setSubtotal] = useState("50");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [confirmArchive, setConfirmArchive] = useState(false);
  const request = useRef<{ payload: string; id: string } | null>(null);
  const readOnly = coupon?.archived ?? false;
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const cents = Math.max(0, Math.round(Number(subtotal) * 100) || 0);
  const discount =
    cents < Math.round(Number(minimum) * 100)
      ? 0
      : Math.min(
          cents,
          Math.max(
            0,
            kind === "percent"
              ? Math.floor((cents * Number(value)) / 100)
              : Math.round(Number(value) * 100),
          ) || 0,
        );
  async function submit(action: "save" | "archive", event?: FormEvent) {
    event?.preventDefault();
    if (busy || readOnly || (action === "save" && confirmArchive)) return;
    setError("");
    if (
      action === "save" &&
      !permanent &&
      (!ends || (starts && new Date(ends) <= new Date(starts)))
    ) {
      setError(
        es
          ? "El vencimiento debe ser posterior al inicio."
          : "Expiry must be after the start.",
      );
      return;
    }
    const body = {
      action,
      value:
        action === "archive"
          ? { id: coupon?.id }
          : {
              ...(coupon ? { id: coupon.id } : {}),
              code: code.trim().toUpperCase(),
              name: name.trim(),
              kind,
              value: Math.round(Number(value) * 100),
              starts_at: starts ? new Date(starts).toISOString() : null,
              ends_at: !permanent && ends ? new Date(ends).toISOString() : null,
              max_uses: max ? Number(max) : null,
              max_uses_per_customer: perPerson ? Number(perPerson) : null,
              minimum_cents: Math.round(Number(minimum) * 100),
              active,
            },
    };
    const payload = JSON.stringify(body);
    if (request.current?.payload !== payload)
      request.current = { payload, id: crypto.randomUUID() };
    setBusy(true);
    try {
      const r = await fetch("/api/admin/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...body, request: request.current.id }),
      });
      if (r.status === 428) {
        router.replace(`/${locale}/admin/security`);
        return;
      }
      const result = await r.json();
      if (!r.ok || !result.ok) {
        setError(
          result.error === "conflict"
            ? es
              ? "El código ya existe o el cupón cambió. Cierra y actualiza la lista antes de reintentar."
              : "The code already exists or the coupon changed. Close and refresh the list before retrying."
            : result.error === "invalid"
              ? es
                ? "Revisa el código, importe, fechas y límites. Los importes deben ser válidos y los límites enteros positivos."
                : "Check the code, amount, dates and limits. Amounts must be valid and limits must be positive whole numbers."
              : es
                ? "No se pudo guardar. Reintenta con los mismos datos."
                : "Could not save. Retry with the same details.",
        );
        return;
      }
      saved(action === "archive");
    } catch {
      setError(
        es
          ? "No se pudo conectar. Reintenta con los mismos datos."
          : "Could not connect. Retry with the same details.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="coupon-dialog"
      aria-labelledby="coupon-editor-title"
      onCancel={(e) => {
        if (busy) e.preventDefault();
      }}
      onClose={close}
    >
      <div className="coupon-dialog-heading">
        <div>
          <p className="eyebrow">
            {es ? "OFERTA PARA VIAJEROS" : "TRAVELER OFFER"}
          </p>
          <h2 id="coupon-editor-title">
            {readOnly
              ? es
                ? "Cupón archivado"
                : "Archived coupon"
              : coupon
                ? es
                  ? "Editar cupón"
                  : "Edit coupon"
                : es
                  ? "Crear cupón"
                  : "Create coupon"}
          </h2>
        </div>
        <button
          className="coupon-icon"
          disabled={busy}
          onClick={close}
          aria-label={es ? "Cerrar" : "Close"}
        >
          <X size={20} />
        </button>
      </div>
      <form onSubmit={(e) => void submit("save", e)}>
        <fieldset disabled={busy || readOnly} className="coupon-fields">
          <legend className="sr-only">
            {es ? "Configuración del cupón" : "Coupon settings"}
          </legend>
          <section>
            <h3>{es ? "Oferta" : "Offer"}</h3>
            <div className="coupon-form-grid">
              <label>
                {es ? "Nombre interno" : "Internal name"}
                <input
                  required
                  autoFocus={!coupon}
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    es
                      ? "Bienvenida a nuevos viajeros"
                      : "Welcome for new travelers"
                  }
                />
              </label>
              <div className="coupon-form-field">
                <label htmlFor="coupon-code">
                  {es ? "Código del cupón" : "Coupon code"}
                </label>
                <div className="coupon-code-input">
                  <input
                    id="coupon-code"
                    required
                    minLength={3}
                    maxLength={40}
                    pattern="[A-Z0-9][A-Z0-9_-]{2,39}"
                    disabled={Boolean(coupon)}
                    title={
                      es
                        ? "Letras, números, guion y guion bajo"
                        : "Letters, numbers, hyphens and underscores"
                    }
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="VIAJE10"
                  />
                  <button
                    type="button"
                    className="coupon-icon"
                    aria-label={es ? "Generar código" : "Generate code"}
                    disabled={Boolean(coupon)}
                    onClick={() =>
                      setCode(
                        `TRIP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
                      )
                    }
                  >
                    <Shuffle size={18} />
                  </button>
                </div>
                {coupon && (
                  <span className="coupon-help">
                    {es
                      ? "El código se conserva para mantener su historial. Puedes editar la oferta, las fechas y los límites."
                      : "The code is kept to preserve its history. You can edit the offer, dates and limits."}
                  </span>
                )}
              </div>
              <label>
                {es ? "Tipo de descuento" : "Discount type"}
                <select
                  value={kind}
                  onChange={(e) =>
                    setKind(e.target.value as "percent" | "fixed")
                  }
                >
                  <option value="percent">
                    {es ? "Porcentaje (%)" : "Percentage (%)"}
                  </option>
                  <option value="fixed">
                    {es ? "Importe fijo (USD)" : "Fixed amount (USD)"}
                  </option>
                </select>
              </label>
              <label>
                {kind === "percent"
                  ? es
                    ? "Porcentaje"
                    : "Percentage"
                  : es
                    ? "Importe en USD"
                    : "Amount in USD"}
                <input
                  type="number"
                  required
                  min="0.01"
                  max={kind === "percent" ? "100" : "100000"}
                  step="0.01"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                />
              </label>
            </div>
          </section>
          <section>
            <h3>{es ? "Vigencia" : "Validity"}</h3>
            <label className="coupon-check">
              <input
                type="checkbox"
                checked={permanent}
                onChange={(e) => setPermanent(e.target.checked)}
              />
              {es ? "Sin fecha de vencimiento" : "No expiry date"}
            </label>
            <div className="coupon-form-grid">
              <label>
                {es ? "Inicio (opcional)" : "Start (optional)"}
                <input
                  type="datetime-local"
                  value={starts}
                  onChange={(e) => setStarts(e.target.value)}
                />
              </label>
              {!permanent && (
                <label>
                  {es ? "Vencimiento exclusivo" : "Exclusive expiry"}
                  <input
                    type="datetime-local"
                    required
                    value={ends}
                    min={starts || undefined}
                    onChange={(e) => setEnds(e.target.value)}
                  />
                </label>
              )}
            </div>
            <p className="coupon-help">
              {es ? "Zona horaria del navegador" : "Browser time zone"}:{" "}
              {Intl.DateTimeFormat().resolvedOptions().timeZone}.{" "}
              {es
                ? "Sin inicio, está disponible al guardar. Deja de ser válido a la hora de vencimiento."
                : "Without a start, available when saved. Stops being valid at the expiry time."}
            </p>
          </section>
          <section>
            <h3>{es ? "Límites" : "Limits"}</h3>
            <div className="coupon-form-grid">
              <label>
                {es ? "Usos totales (opcional)" : "Total uses (optional)"}
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={max}
                  onChange={(e) => setMax(e.target.value)}
                  placeholder={es ? "Sin límite" : "Unlimited"}
                />
              </label>
              <label>
                {es
                  ? "Usos por persona (opcional)"
                  : "Uses per person (optional)"}
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={perPerson}
                  onChange={(e) => setPerPerson(e.target.value)}
                  placeholder={es ? "Sin límite" : "Unlimited"}
                />
              </label>
              <label>
                {es ? "Compra mínima (USD)" : "Minimum purchase (USD)"}
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={minimum}
                  onChange={(e) => setMinimum(e.target.value)}
                />
              </label>
            </div>
            <p className="coupon-help">
              {es
                ? "El límite por persona usa la identidad del cliente y su correo de compra, también para invitados. Los usos reservados cuentan para la disponibilidad."
                : "The per-person limit uses customer identity and checkout email, including guests. Reserved uses count toward availability."}
            </p>
            <label className="coupon-check">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              {es ? "Cupón activo" : "Coupon active"}
            </label>
          </section>
        </fieldset>
        <aside className="coupon-preview">
          <div>
            <TicketPercent size={26} />
            <span className="coupon-code">{code || "VIAJE10"}</span>
            <strong>
              {kind === "percent"
                ? `${value || 0}%`
                : formatUSD(Math.round(Number(value) * 100) || 0, locale)}
            </strong>
          </div>
          <label>
            {es ? "Simular compra (USD)" : "Preview purchase (USD)"}
            <input
              type="number"
              min="0"
              step="0.01"
              value={subtotal}
              onChange={(e) => setSubtotal(e.target.value)}
            />
          </label>
          <dl>
            <div>
              <dt>{es ? "Descuento estimado" : "Estimated discount"}</dt>
              <dd>−{formatUSD(discount, locale)}</dd>
            </div>
            <div>
              <dt>{es ? "Total estimado" : "Estimated total"}</dt>
              <dd>{formatUSD(cents - discount, locale)}</dd>
            </div>
          </dl>
          <p>
            {es
              ? "Estimación: el descuento final puede variar por redondeo por unidad y cambio de moneda. Al comprar se verifica la disponibilidad y un margen mínimo del 20% con una estimación conservadora de comisiones. Un cupón por compra; no se combina con SimCoins."
              : "Estimate: the final discount may vary with per-unit rounding and currency conversion. Availability and a minimum 20% margin with conservative fee estimates are checked at purchase. One coupon per purchase; cannot be combined with SimCoins."}
          </p>
        </aside>
        {error && (
          <p className="coupon-error" role="alert">
            {error}
          </p>
        )}
        {confirmArchive && (
          <div className="coupon-archive-confirm" role="alert">
            <p>
              {es
                ? "¿Archivar este cupón? Ya no se podrá usar. Su historial se conserva y no se puede restaurar desde aquí."
                : "Archive this coupon? It can no longer be used. Its history is preserved and it cannot be restored here."}
            </p>
            <button
              type="button"
              className="button button-secondary"
              disabled={busy}
              onClick={() => setConfirmArchive(false)}
            >
              {es ? "Cancelar" : "Cancel"}
            </button>
            <button
              type="button"
              className="button coupon-danger"
              disabled={busy}
              onClick={() => void submit("archive")}
            >
              {es ? "Archivar cupón" : "Archive coupon"}
            </button>
          </div>
        )}
        <footer className="coupon-editor-actions">
          {coupon && !readOnly && (
            <button
              type="button"
              className="coupon-archive-button"
              disabled={busy}
              onClick={() => setConfirmArchive(true)}
            >
              <Archive size={17} />
              {es ? "Eliminar / archivar" : "Delete / archive"}
            </button>
          )}
          <button
            type="button"
            className="button button-secondary"
            disabled={busy}
            onClick={close}
          >
            {es ? "Cerrar" : "Close"}
          </button>
          {!readOnly && (
            <button
              type="submit"
              className="button button-primary"
              disabled={busy || confirmArchive}
            >
              <Check size={17} />
              {busy
                ? es
                  ? "Guardando…"
                  : "Saving…"
                : es
                  ? "Guardar cupón"
                  : "Save coupon"}
            </button>
          )}
        </footer>
      </form>
    </dialog>
  );
}
