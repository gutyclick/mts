"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Globe2,
  LayoutDashboard,
  LifeBuoy,
  LoaderCircle,
  LogOut,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  Wifi,
  X,
} from "lucide-react";
import {
  adminFilters,
  adminPlanSchema,
  adminUserSchema,
  adminOrderSchema,
  overviewSchema,
  pageSchema,
  type AdminOverview,
  type AdminPlan,
  type AdminUser,
  type AdminOrder,
} from "@/lib/admin/model";
import type { Locale } from "@/lib/i18n";
import { Brand } from "@/components/ui";
import { SimMascot } from "@/components/sim-mascot";
import { LanguageSwitcher } from "@/components/site-navigation";
import { signOut } from "@/lib/account-actions";
import { formatUSD } from "@/lib/retail-prices";
import { authPath } from "@/lib/auth-routes";
type PageData = {
  rows: (AdminPlan | AdminUser | AdminOrder)[];
  total: number;
  page: number;
  pageSize: number;
};
type Data =
  { kind: "summary"; value: AdminOverview } | { kind: "list"; value: PageData };
const date = (v: string | null, es: boolean) =>
  v
    ? new Intl.DateTimeFormat(es ? "es-PA" : "en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "America/Panama",
      }).format(new Date(v))
    : "—";
const allowance = (gb: number) =>
  gb < 1 ? `${Math.round(gb * 1000)} MB` : `${gb} GB`;
const statusText = (s: string, es: boolean) =>
  ({
    active: es ? "En uso" : "In use",
    ready: es ? "Lista para instalar" : "Ready to install",
    suspended: es ? "Suspendida" : "Suspended",
    expired: es ? "Finalizada" : "Ended",
    queued: es ? "En preparación" : "Preparing",
    provider_pending: es ? "Preparando QR" : "Preparing QR",
    review: es ? "Requiere revisión" : "Needs review",
    sent: es ? "Correo enviado" : "Email sent",
    test_skipped: es ? "Sin emisión · Prueba" : "Not issued · Test",
    pending: es ? "Pago pendiente" : "Payment pending",
    paid: es ? "Pagado" : "Paid",
    cancelled: es ? "Cancelado" : "Cancelled",
    failed: es ? "Pago fallido" : "Payment failed",
  })[s] ?? s;
const reasonText = (s: string | null, es: boolean) =>
  ({
    delivery_review: es ? "Revisar entrega" : "Review delivery",
    suspended: es ? "Plan suspendido" : "Plan suspended",
    low_data: es ? "Quedan pocos datos" : "Low data remaining",
    expiry_soon: es ? "Vence pronto" : "Expiring soon",
    followup: es ? "Seguimiento abierto" : "Open follow-up",
  })[s ?? ""] ?? "";
function Badge({ state, es }: { state: string; es: boolean }) {
  return (
    <span className={`admin-badge admin-state-${state}`}>
      {statusText(state, es)}
    </span>
  );
}
export function AdminDashboard({
  locale,
  email,
}: {
  locale: Locale;
  email: string;
}) {
  const es = locale === "es",
    router = useRouter(),
    search = useSearchParams(),
    query = search.toString();
  const parsed = adminFilters.safeParse(Object.fromEntries(search));
  const filters = parsed.success ? parsed.data : adminFilters.parse({});
  const [data, setData] = useState<Data | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [refresh, setRefresh] = useState(0),
    [selected, setSelected] = useState<AdminPlan | null>(null),
    [busy, setBusy] = useState<string | null>(null),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(false);
      setData(null);
      try {
        const r = await fetch(`/api/admin/data?${query}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        if (r.status === 428) {
          router.replace(`/${locale}/admin/security`);
          return;
        }
        if (!r.ok) throw new Error("Unavailable");
        const value = await r.json();
        if (controller.signal.aborted) return;
        if (filters.tab === "summary") {
          const overview = overviewSchema.parse(value);
          setData({ kind: "summary", value: overview });
          setSelected(
            (old) => overview.recentPlans.find((p) => p.id === old?.id) ?? old,
          );
        } else {
          const page = pageSchema.parse(value);
          const rows =
            filters.tab === "users"
              ? page.rows.map((p) => adminUserSchema.parse(p))
              : filters.tab === "orders"
                ? page.rows.map((p) => adminOrderSchema.parse(p))
                : page.rows.map((p) => adminPlanSchema.parse(p));
          setData({ kind: "list", value: { ...page, rows } });
          if (filters.tab === "plans" || filters.tab === "attention")
            setSelected(
              (old) =>
                (rows as AdminPlan[]).find((p) => p.id === old?.id) ?? old,
            );
        }
      } catch {
        if (!controller.signal.aborted) {
          setError(true);
          setData(null);
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [query, refresh, filters.tab, router, locale]);
  function navigate(values: Record<string, string>) {
    const params = new URLSearchParams(query);
    params.delete("page");
    for (const [k, v] of Object.entries(values)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    setLoading(true);
    setData(null);
    if (params.toString() === query) setRefresh((v) => v + 1);
    else router.replace(`/${locale}/admin?${params}`, { scroll: false });
    setNotice("");
  }
  const sections = [
    {
      id: "summary",
      label: es ? "Resumen" : "Overview",
      icon: LayoutDashboard,
    },
    { id: "users", label: es ? "Usuarios" : "Users", icon: Users },
    {
      id: "plans",
      label: es ? "Planes y eSIM" : "Plans and eSIMs",
      icon: Wifi,
    },
    { id: "orders", label: es ? "Pedidos" : "Orders", icon: Package },
    { id: "attention", label: es ? "Atención" : "Attention", icon: LifeBuoy },
  ] as const;
  async function action(
    body:
      | { action: "sync"; id: string }
      | { action: "followup"; id: string; note: string; resolved: boolean },
  ) {
    setBusy(body.id);
    setNotice("");
    try {
      const r = await fetch("/api/admin/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.status === 428) {
        router.replace(`/${locale}/admin/security`);
        return;
      }
      if (r.status === 429) {
        setNotice(
          es
            ? "Este plan acaba de consultarse. Espera un minuto antes de actualizarlo."
            : "This plan was checked recently. Wait a minute before refreshing.",
        );
        return;
      }
      if (!r.ok) throw new Error("Unavailable");
      setNotice(
        body.action === "sync"
          ? es
            ? "Estado consultado al proveedor. El consumo puede llevar retraso."
            : "Provider status checked. Usage may be delayed."
          : es
            ? "Seguimiento guardado."
            : "Follow-up saved.",
      );
      setRefresh((v) => v + 1);
    } catch {
      setNotice(
        es
          ? "No se pudo completar la acción. Los datos anteriores se conservan; puedes reintentarlo."
          : "The action could not be completed. Previous data is preserved; you can try again.",
      );
    } finally {
      setBusy(null);
    }
  }
  function planRows(plans: AdminPlan[]) {
    return (
      <div className="admin-record-list">
        {plans.map((plan) => (
          <article className="admin-record admin-plan-record" key={plan.id}>
            <div className="admin-record-primary">
              <span className="admin-record-icon">
                <Globe2 size={21} />
              </span>
              <div>
                <h3>{plan.destination_name[locale]}</h3>
                <p>{plan.plan_name}</p>
                <small>{plan.email ?? (es ? "Invitado" : "Guest")}</small>
                {plan.qa_authorized && (
                  <span className="admin-test-tag">QA · eSIM real</span>
                )}
              </div>
            </div>
            <div>
              <Badge state={plan.status} es={es} />
              {plan.attention && (
                <small className="admin-attention-label">
                  {reasonText(plan.attention, es)}
                </small>
              )}
            </div>
            <div className="admin-data-meter">
              <strong>
                {plan.used_bytes === null
                  ? "—"
                  : `${Math.round((Math.max(0, plan.volume_bytes - plan.used_bytes) / plan.volume_bytes) * 100)}%`}
              </strong>
              <span>{es ? "datos disponibles" : "data remaining"}</span>
              <progress
                max={plan.volume_bytes}
                value={Math.max(0, plan.volume_bytes - (plan.used_bytes ?? 0))}
                aria-label={es ? "Datos disponibles" : "Data remaining"}
              />
              <small>
                {allowance(plan.data_gb)} · {plan.days} {es ? "días" : "days"}
              </small>
            </div>
            <div className="admin-record-date">
              <span>{es ? "Última consulta" : "Last checked"}</span>
              <small>
                {plan.provider_checked_at
                  ? date(plan.provider_checked_at, es)
                  : es
                    ? "Sin consultar"
                    : "Not checked yet"}
              </small>
            </div>
            <button
              className="button button-secondary"
              onClick={() => {
                setSelected(plan);
                setNotice("");
              }}
            >
              {es ? "Ver detalle" : "View details"}
              <ArrowRight size={15} />
            </button>
          </article>
        ))}
      </div>
    );
  }
  return (
    <div className="admin-workspace">
      <aside className="admin-sidebar">
        <Link
          href={`/${locale}`}
          className="admin-brand"
          aria-label="MyTripSim"
        >
          <Brand />
        </Link>
        <p className="admin-workspace-label">
          <ShieldCheck size={14} />
          {es ? "ADMINISTRACIÓN" : "ADMINISTRATION"}
        </p>
        <nav aria-label={es ? "Administración" : "Administration"}>
          {sections.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              aria-current={filters.tab === id ? "page" : undefined}
              onClick={() => navigate({ tab: id, q: "", status: "", user: "" })}
            >
              <Icon size={20} />
              <span>{label}</span>
              {id === "attention" &&
                data?.kind === "summary" &&
                data.value.attention > 0 && (
                  <span className="admin-nav-count">
                    {data.value.attention}
                  </span>
                )}
            </button>
          ))}
          <Link
            href={`/${locale}/admin/operations`}
            className="admin-support-link"
          >
            <Activity size={20} />
            {es ? "Operaciones" : "Operations"}
          </Link>
          <Link
            href={`/${locale}/admin/tickets`}
            className="admin-support-link"
          >
            <LifeBuoy size={20} />
            {es ? "Tickets de ayuda" : "Support tickets"}
          </Link>
        </nav>
        <div className="admin-sidebar-bottom">
          <p>{email}</p>
          <Link href={`/${locale}`}>
            <ArrowLeft size={16} />
            {es ? "Volver a la web" : "Back to website"}
          </Link>
          <form action={signOut}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit">
              <LogOut size={16} />
              {es ? "Cerrar sesión" : "Sign out"}
            </button>
          </form>
        </div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <span>
            <span className="admin-live-dot" />
            {es ? "Espacio privado" : "Private workspace"}
          </span>
          <div>
            <LanguageSwitcher locale={locale} />
            <form action={signOut} className="admin-mobile-signout">
              <input type="hidden" name="locale" value={locale} />
              <button
                className="icon-button"
                aria-label={es ? "Cerrar sesión" : "Sign out"}
              >
                <LogOut size={17} />
              </button>
            </form>
            <button
              className="button button-secondary"
              disabled={loading}
              onClick={() => setRefresh((v) => v + 1)}
            >
              <RefreshCw
                size={16}
                className={loading ? "payment-spinner" : ""}
              />
              <span>{es ? "Actualizar" : "Refresh"}</span>
            </button>
          </div>
        </header>
        <section className="admin-page-heading">
          <div>
            <p className="eyebrow">
              MYTRIPSIM / {es ? "OPERACIONES" : "OPERATIONS"}
            </p>
            <h1>
              {filters.tab === "summary"
                ? es
                  ? "Cada conexión, bajo control."
                  : "Every connection, in view."
                : sections.find((s) => s.id === filters.tab)?.label}
            </h1>
            <p>
              {filters.tab === "summary"
                ? es
                  ? "Personas, viajes y conexiones. Todo en su sitio."
                  : "People, journeys and connections. Everything in place."
                : filters.tab === "attention"
                  ? es
                    ? "Prioriza las conexiones que necesitan una mano."
                    : "Focus on connections that need a hand."
                  : es
                    ? "Busca, revisa y acompaña cada viaje."
                    : "Find, review and support every journey."}
            </p>
          </div>
          {filters.tab === "summary" && (
            <SimMascot
              variant="help"
              locale={locale}
              sizes="160px"
              className="admin-hero-sim"
            />
          )}
        </section>
        {notice && (
          <p className="admin-notice" role="status">
            <InfoIcon />
            {notice}
          </p>
        )}
        {filters.tab !== "summary" && (
          <section
            className="admin-filterbar"
            aria-label={es ? "Filtros" : "Filters"}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                navigate({
                  q: String(new FormData(e.currentTarget).get("q") ?? ""),
                });
              }}
            >
              <label className="sr-only" htmlFor="admin-search">
                {es ? "Buscar" : "Search"}
              </label>
              <Search size={18} />
              <input
                key={filters.q}
                id="admin-search"
                name="q"
                defaultValue={filters.q}
                maxLength={80}
                placeholder={
                  es
                    ? "Buscar correo, plan o pedido…"
                    : "Search email, plan or order…"
                }
              />
              <button
                className="admin-search-submit"
                type="submit"
                aria-label={es ? "Buscar" : "Search"}
              >
                <ArrowRight size={18} />
              </button>
            </form>
            <label>
              <span>{es ? "Estado" : "Status"}</span>
              <select
                value={filters.status}
                onChange={(e) => navigate({ status: e.target.value })}
              >
                <option value="">
                  {es ? "Todos los estados" : "All statuses"}
                </option>
                {(filters.tab === "users"
                  ? ["active"]
                  : filters.tab === "orders"
                    ? ["paid", "pending", "cancelled", "expired", "failed"]
                    : [
                        "active",
                        "ready",
                        "suspended",
                        "expired",
                        "queued",
                        "provider_pending",
                        "review",
                        "test_skipped",
                      ]
                ).map((s) => (
                  <option value={s} key={s}>
                    {filters.tab === "users"
                      ? es
                        ? "Con planes activos"
                        : "With active plans"
                      : statusText(s, es)}
                  </option>
                ))}
              </select>
            </label>
            {filters.tab !== "users" && (
              <label>
                <span>{es ? "Entorno" : "Environment"}</span>
                <select
                  value={filters.environment}
                  onChange={(e) => navigate({ environment: e.target.value })}
                >
                  <option value="all">{es ? "Todos" : "All"}</option>
                  <option value="live">
                    {es ? "Ventas reales" : "Live sales"}
                  </option>
                  <option value="qa">
                    {es ? "Prueba con eSIM real" : "QA with real eSIM"}
                  </option>
                  <option value="test">Stripe test</option>
                </select>
              </label>
            )}
            {filters.user && (
              <button
                className="admin-filter-chip"
                onClick={() => navigate({ user: "" })}
              >
                {es ? "Cliente seleccionado" : "Selected customer"}
                <X size={14} />
              </button>
            )}
          </section>
        )}
        {error ? (
          <div className="admin-empty" role="alert">
            <ShieldCheck size={34} />
            <h2>
              {es
                ? "No pudimos cargar la administración"
                : "We couldn’t load administration"}
            </h2>
            <p>
              {es
                ? "Comprueba tu sesión y vuelve a intentarlo. Sólo las cuentas autorizadas pueden acceder."
                : "Check your session and try again. Only authorized accounts can access this area."}
            </p>
            <Link
              className="button button-secondary"
              href={`${authPath(locale, "login")}?next=/${locale}/admin`}
            >
              {es ? "Iniciar sesión" : "Sign in"}
            </Link>
          </div>
        ) : loading ? (
          <div className="admin-loading" role="status">
            <LoaderCircle className="payment-spinner" size={25} />
            {es ? "Preparando tu espacio…" : "Preparing your workspace…"}
          </div>
        ) : data?.kind === "summary" ? (
          <>
            <div className="admin-metric-grid">
              {[
                {
                  label: es ? "Usuarios registrados" : "Registered users",
                  value: data.value.users,
                  icon: Users,
                  tone: "blue",
                  tab: "users",
                },
                {
                  label: es ? "Planes en uso" : "Plans in use",
                  value: data.value.activePlans,
                  icon: Wifi,
                  tone: "green",
                  tab: "plans",
                },
                {
                  label: es ? "Listos para instalar" : "Ready to install",
                  value: data.value.readyPlans,
                  icon: Package,
                  tone: "blue",
                  tab: "plans",
                },
                {
                  label: es ? "Necesitan atención" : "Need attention",
                  value: data.value.attention,
                  icon: LifeBuoy,
                  tone: "orange",
                  tab: "attention",
                },
              ].map((m) => (
                <button
                  className={`admin-metric metric-${m.tone}`}
                  key={m.label}
                  onClick={() =>
                    navigate({
                      tab: m.tab,
                      status:
                        m.tab === "plans"
                          ? m.tone === "green"
                            ? "active"
                            : "ready"
                          : "",
                      q: "",
                      user: "",
                    })
                  }
                >
                  <span className="admin-metric-icon">
                    <m.icon size={23} />
                  </span>
                  <span>{m.label}</span>
                  <strong>{m.value}</strong>
                  <ArrowRight className="admin-metric-arrow" size={17} />
                </button>
              ))}
            </div>
            <div className="admin-summary-grid">
              <section className="admin-panel">
                <div className="admin-section-title">
                  <h2>
                    <Activity size={20} />
                    {es ? "Ventas reales" : "Live sales"}
                  </h2>
                  <span>{es ? "Últimos 7 días" : "Last 7 days"}</span>
                </div>
                <strong className="admin-revenue">
                  {formatUSD(data.value.liveRevenueCents, locale)}
                </strong>
                <p className="admin-caption">
                  {es
                    ? "Total confirmado. Los pagos de prueba no se incluyen."
                    : "Confirmed total. Test payments are excluded."}
                </p>
                {data.value.daily.some((d) => d.orders > 0) ? (
                  <ol
                    className="admin-chart"
                    aria-label={
                      es
                        ? "Pedidos pagados reales por día"
                        : "Daily paid live orders"
                    }
                  >
                    {data.value.daily.map((d) => (
                      <li key={d.day}>
                        <span className="sr-only">
                          {d.day}: {d.orders}
                        </span>
                        <div
                          style={{
                            height: `${Math.max(4, (d.orders / Math.max(1, ...data.value.daily.map((x) => x.orders))) * 80)}px`,
                          }}
                        />
                        <small>
                          {new Date(`${d.day}T12:00:00Z`).toLocaleDateString(
                            es ? "es-PA" : "en-US",
                            { weekday: "short" },
                          )}
                        </small>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="admin-no-sales">
                    <Package size={26} />
                    <span>
                      {es
                        ? "Las ventas reales de esta semana aparecerán aquí."
                        : "This week’s live sales will appear here."}
                    </span>
                  </div>
                )}
                <p className="admin-caption">
                  {data.value.testOrders}{" "}
                  {es
                    ? "pedidos en Stripe test, separados de las ventas."
                    : "Stripe test orders, kept separate from sales."}
                </p>
              </section>
              <section className="admin-panel">
                <div className="admin-section-title">
                  <h2>
                    <ClipboardList size={20} />
                    {es ? "Bitácora de atención" : "Support activity"}
                  </h2>
                </div>
                {data.value.activity.length ? (
                  <ol className="admin-activity">
                    {data.value.activity.map((a, i) => (
                      <li key={`${a.created_at}-${i}`}>
                        <span>
                          <Check size={14} />
                        </span>
                        <div>
                          <strong>
                            {a.action === "followup_saved"
                              ? es
                                ? "Seguimiento actualizado"
                                : "Follow-up updated"
                              : a.action === "provider_checked"
                                ? es
                                  ? "Estado consultado"
                                  : "Status checked"
                                : es
                                  ? "Consulta sin respuesta"
                                  : "Status check failed"}
                          </strong>
                          <small>
                            {date(a.created_at, es)} · #
                            {a.unit_id.slice(0, 8).toUpperCase()}
                          </small>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <div className="admin-quiet">
                    <ShieldCheck size={28} />
                    <p>
                      {es
                        ? "Aquí quedarán registradas tus comprobaciones y seguimientos."
                        : "Your checks and follow-ups will appear here."}
                    </p>
                  </div>
                )}
              </section>
            </div>
            <section className="admin-panel admin-recent">
              <div className="admin-section-title">
                <h2>
                  <Globe2 size={20} />
                  {es ? "Conexiones recientes" : "Recent connections"}
                </h2>
                <button
                  onClick={() =>
                    navigate({ tab: "plans", q: "", status: "", user: "" })
                  }
                >
                  {es ? "Ver todas" : "View all"}
                  <ArrowRight size={15} />
                </button>
              </div>
              {data.value.recentPlans.length ? (
                planRows(data.value.recentPlans)
              ) : (
                <p className="admin-caption">
                  {es
                    ? "Las eSIM emitidas aparecerán aquí."
                    : "Issued eSIMs will appear here."}
                </p>
              )}
            </section>
          </>
        ) : data?.kind === "list" ? (
          <section className="admin-panel admin-list-panel">
            <div className="admin-section-title">
              <h2>
                {sections.find((s) => s.id === filters.tab)?.label}
                <span className="admin-count">{data.value.total}</span>
              </h2>
              <span>{es ? "20 por página" : "20 per page"}</span>
            </div>
            {!data.value.rows.length ? (
              <div className="admin-empty">
                <Search size={32} />
                <h2>{es ? "Todo despejado por aquí" : "Nothing here yet"}</h2>
                <p>
                  {es
                    ? "No hay resultados con estos filtros. Puedes cambiarlos para explorar otras conexiones."
                    : "No results match these filters. Change them to explore other connections."}
                </p>
              </div>
            ) : filters.tab === "users" ? (
              <div className="admin-record-list">
                {(data.value.rows as AdminUser[]).map((u) => (
                  <article
                    className="admin-record admin-user-record"
                    key={u.id}
                  >
                    <div className="admin-record-primary">
                      <span className="admin-avatar">
                        {(u.name.trim() || u.email || "?")
                          .slice(0, 1)
                          .toUpperCase()}
                      </span>
                      <div>
                        <h3>
                          {u.name.trim() || (es ? "Viajero" : "Traveler")}
                        </h3>
                        <p>{u.email}</p>
                        <small>
                          {es ? "Desde" : "Since"} {date(u.created_at, es)}
                        </small>
                      </div>
                    </div>
                    <div className="admin-number-pair">
                      <strong>{u.active_plans}</strong>
                      <span>{es ? "planes en uso" : "plans in use"}</span>
                      <small>
                        {u.issued_plans} {es ? "emitidos" : "issued"}
                      </small>
                    </div>
                    <div className="admin-number-pair">
                      <strong>{u.paid_orders}</strong>
                      <span>{es ? "pedidos pagados" : "paid orders"}</span>
                      <small>{es ? "Incluye pruebas" : "Includes tests"}</small>
                    </div>
                    <span
                      className={`admin-badge ${u.confirmed ? "admin-state-active" : ""}`}
                    >
                      {u.confirmed
                        ? es
                          ? "Correo confirmado"
                          : "Email confirmed"
                        : es
                          ? "Por confirmar"
                          : "Unconfirmed"}
                    </span>
                    <button
                      className="button button-secondary"
                      onClick={() =>
                        navigate({
                          tab: "plans",
                          user: u.id,
                          q: "",
                          status: "",
                        })
                      }
                    >
                      {es ? "Ver planes" : "View plans"}
                      <ArrowRight size={15} />
                    </button>
                  </article>
                ))}
              </div>
            ) : filters.tab === "orders" ? (
              <div className="admin-record-list">
                {(data.value.rows as AdminOrder[]).map((o) => (
                  <article
                    className="admin-record admin-order-record"
                    key={o.id}
                  >
                    <div className="admin-record-primary">
                      <span className="admin-record-icon">
                        <Package size={21} />
                      </span>
                      <div>
                        <h3>#{o.id.slice(0, 8).toUpperCase()}</h3>
                        <p>{o.email}</p>
                        <small>{date(o.created_at, es)}</small>
                      </div>
                    </div>
                    <div className="admin-order-items">
                      {o.items?.map((i, n) => (
                        <p key={n}>
                          {i.name} <strong>×{i.quantity}</strong>
                        </p>
                      ))}
                    </div>
                    <Badge state={o.status} es={es} />
                    <div className="admin-order-amount">
                      <strong>{formatUSD(o.amount_total, locale)}</strong>
                      <small>
                        {o.livemode
                          ? es
                            ? "Pago real"
                            : "Live payment"
                          : "Stripe test"}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              planRows(data.value.rows as AdminPlan[])
            )}
            <div className="admin-pagination">
              <span>
                {data.value.total
                  ? `${(filters.page - 1) * 20 + 1}–${Math.min(filters.page * 20, data.value.total)} ${es ? "de" : "of"} ${data.value.total}`
                  : "0"}
              </span>
              <div>
                <button
                  className="icon-button"
                  aria-label={es ? "Página anterior" : "Previous page"}
                  disabled={filters.page <= 1}
                  onClick={() => navigate({ page: String(filters.page - 1) })}
                >
                  <ChevronLeft size={19} />
                </button>
                <span>{filters.page}</span>
                <button
                  className="icon-button"
                  aria-label={es ? "Página siguiente" : "Next page"}
                  disabled={filters.page * 20 >= data.value.total}
                  onClick={() => navigate({ page: String(filters.page + 1) })}
                >
                  <ChevronRight size={19} />
                </button>
              </div>
            </div>
          </section>
        ) : null}
        <p className="admin-footer-note">
          <Clock3 size={15} />
          {es
            ? "El estado se actualiza al consultar al proveedor. El consumo puede llevar 2–3 horas de retraso."
            : "Status updates when you check the provider. Usage may be delayed by 2–3 hours."}
        </p>
      </div>
      {selected && (
        <PlanDetail
          key={selected.id}
          plan={selected}
          locale={locale}
          busy={busy === selected.id}
          close={() => setSelected(null)}
          action={action}
          notice={notice}
        />
      )}
    </div>
  );
}
function InfoIcon() {
  return <ShieldCheck size={17} />;
}
function PlanDetail({
  plan,
  locale,
  busy,
  close,
  action,
  notice,
}: {
  plan: AdminPlan;
  locale: Locale;
  busy: boolean;
  close: () => void;
  action: (
    body:
      | { action: "sync"; id: string }
      | { action: "followup"; id: string; note: string; resolved: boolean },
  ) => Promise<void>;
  notice: string;
}) {
  const es = locale === "es",
    ref = useRef<HTMLDialogElement>(null),
    [note, setNote] = useState(plan.note),
    [resolved, setResolved] = useState(plan.resolved);
  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="admin-detail"
      aria-labelledby="admin-detail-title"
      onClose={close}
      onClick={(e) => {
        if (e.target === e.currentTarget) ref.current?.close();
      }}
    >
      <div className="admin-detail-heading">
        <span className="admin-record-icon">
          <Globe2 size={25} />
        </span>
        <button
          className="icon-button"
          aria-label={es ? "Cerrar detalle" : "Close details"}
          onClick={() => ref.current?.close()}
        >
          <X size={20} />
        </button>
      </div>
      <p className="eyebrow">#{plan.order_id.slice(0, 8).toUpperCase()}</p>
      <h2 id="admin-detail-title">{plan.destination_name[locale]}</h2>
      <p className="admin-detail-plan">{plan.plan_name}</p>
      <Badge state={plan.status} es={es} />
      {plan.attention && (
        <p className="admin-attention-label">
          {reasonText(plan.attention, es)}
        </p>
      )}
      <dl className="admin-detail-facts">
        {[
          [es ? "Cliente" : "Customer", plan.email ?? "—"],
          [es ? "Beneficiario" : "Recipient", plan.recipient_email],
          [
            es ? "Plan" : "Plan",
            `${allowance(plan.data_gb)} · ${plan.days} ${es ? "días" : "days"}`,
          ],
          [es ? "Entrega" : "Delivery", statusText(plan.delivery_state, es)],
          [
            es ? "Última consulta" : "Last checked",
            date(plan.provider_checked_at, es),
          ],
          [
            es ? "Vencimiento informado" : "Reported expiry",
            date(plan.expires_at, es),
          ],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {plan.can_sync && (
        <button
          className="button button-secondary admin-sync-button"
          disabled={busy}
          onClick={() => action({ action: "sync", id: plan.id })}
        >
          <RefreshCw size={17} className={busy ? "payment-spinner" : ""} />
          {es ? "Consultar estado y consumo" : "Check status and usage"}
        </button>
      )}
      <form
        className="admin-note-form"
        onSubmit={(e) => {
          e.preventDefault();
          void action({ action: "followup", id: plan.id, note, resolved });
        }}
      >
        <h3>
          <ClipboardList size={19} />
          {es ? "Seguimiento interno" : "Internal follow-up"}
        </h3>
        <label htmlFor="admin-note">
          {es ? "Observaciones para tu equipo" : "Notes for your team"}
        </label>
        <textarea
          id="admin-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder={
            es
              ? "Por ejemplo: revisar conexión al llegar a destino."
              : "For example: check connection on arrival."
          }
        />
        <div className="admin-note-options">
          <label>
            <input
              type="checkbox"
              checked={resolved}
              onChange={(e) => setResolved(e.target.checked)}
            />
            {es ? "Marcar como revisado" : "Mark as reviewed"}
          </label>
          <span>{note.length}/1000</span>
        </div>
        <p className="admin-caption">
          {es
            ? "Estas notas son privadas. Marcar revisado no modifica el plan ni envía mensajes."
            : "These notes are private. Marking reviewed does not change the plan or send messages."}
        </p>
        <button className="button button-primary" disabled={busy}>
          <Check size={17} />
          {es ? "Guardar seguimiento" : "Save follow-up"}
        </button>
      </form>
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
    </dialog>
  );
}
