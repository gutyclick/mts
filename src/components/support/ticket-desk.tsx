"use client";
import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Headphones,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  Send,
  Ticket,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import {
  supportMessageSchema,
  supportThreadSchema,
  ticketReference,
  type SupportMessage,
  type SupportThread,
} from "@/lib/support/model";
import { ConversationRating } from "./conversation-rating";
import { SimMascot } from "../sim-mascot";
import {
  SupportMessages,
  statusText,
  supportError,
  supportFetch,
} from "./shared";
type Detail = {
  thread: SupportThread;
  messages: SupportMessage[];
  total: number;
  page: number;
  order: {
    reference: string;
    paymentStatus: string;
    test: boolean;
    plans: { plan_name: string }[];
    esims: { state: string; provider_status: string | null }[];
  } | null;
};
export function TicketDesk({
  locale,
  staff = false,
}: {
  locale: Locale;
  staff?: boolean;
}) {
  const es = locale === "es",
    router = useRouter(),
    params = useSearchParams(),
    selected = params.get("ticket") ?? "",
    endpoint = staff ? "/api/admin/support/tickets" : "/api/support/tickets",
    base = `/${locale}/${staff ? "admin/tickets" : "support"}`;
  const [rows, setRows] = useState<SupportThread[]>([]),
    [total, setTotal] = useState(0),
    [page, setPage] = useState(1),
    [status, setStatus] = useState(""),
    [query, setQuery] = useState(""),
    [search, setSearch] = useState(""),
    [detail, setDetail] = useState<Detail | null>(null),
    [messagePage, setMessagePage] = useState(1),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [create, setCreate] = useState(false),
    [body, setBody] = useState(""),
    [subject, setSubject] = useState(""),
    [order, setOrder] = useState(""),
    [orders, setOrders] = useState<
      { id: string; items: { plan_name: string }[] }[]
    >([]),
    request = useRef<string | null>(null);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const filters = new URLSearchParams({
            status,
            q: search,
            page: String(page),
          }),
          list = await supportFetch(`${endpoint}?${filters}`, { signal });
        if (signal?.aborted) return;
        setRows(list.rows.map((v: unknown) => supportThreadSchema.parse(v)));
        setTotal(list.total);
        if (selected) {
          const d = await supportFetch(
            `${endpoint}?id=${encodeURIComponent(selected)}&page=${messagePage}`,
            { signal },
          );
          if (signal?.aborted) return;
          setDetail({
            ...d,
            thread: supportThreadSchema.parse(d.thread),
            messages: d.messages.map((v: unknown) =>
              supportMessageSchema.parse(v),
            ),
          });
        } else setDetail(null);
      } catch (e) {
        if (!signal?.aborted) setError(supportError(e, es));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [endpoint, es, page, search, status, selected, messagePage],
  );
  useEffect(() => {
    const abort = new AbortController();
    startTransition(() => void load(abort.signal));
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void load(abort.signal);
    }, 20000);
    return () => {
      abort.abort();
      clearInterval(timer);
    };
  }, [load]);
  useEffect(() => {
    if (staff) return;
    const abort = new AbortController();
    void supportFetch("/api/support/session", { signal: abort.signal })
      .then((d) => {
        if (!abort.signal.aborted) setOrders(d.orders ?? []);
      })
      .catch(() => {});
    return () => abort.abort();
  }, [staff]);
  function select(id: string) {
    setDetail(null);
    setMessagePage(1);
    setBody("");
    setCreate(false);
    request.current = null;
    router.push(`${base}?ticket=${id}`, { scroll: false });
  }
  async function mutate(
    action: "create" | "reply" | "resolve",
    e?: React.FormEvent,
  ) {
    e?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    request.current ??= crypto.randomUUID();
    try {
      const operation =
        action === "create"
          ? {
              action,
              requestId: request.current,
              subject,
              body,
              ...(order ? { orderId: order } : {}),
            }
          : action === "reply"
            ? { action, threadId: selected, requestId: request.current, body }
            : { action, threadId: selected };
      const result = await supportFetch(endpoint, {
        method: "POST",
        body: JSON.stringify({ locale, request: operation }),
      });
      request.current = null;
      setBody("");
      setCreate(false);
      if (action === "create") {
        setSubject("");
        select(result.id);
      } else await load();
    } catch (e) {
      setError(supportError(e, es));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className={`support-desk ${staff ? "support-desk-admin" : ""}`}>
      <div className="support-page-heading">
        <div>
          <Link
            className="support-back"
            href={
              staff
                ? `/${locale}/admin`
                : `/${locale}/${es ? "mis-esim" : "my-esims"}`
            }
          >
            <ArrowLeft size={16} />
            {staff
              ? es
                ? "Administración"
                : "Administration"
              : es
                ? "Mis eSIM"
                : "My eSIMs"}
          </Link>
          <span className="support-eyebrow">
            MYTRIPSIM / {es ? "AYUDA" : "SUPPORT"}
          </span>
          <h1>
            {staff
              ? es
                ? "Tickets de soporte"
                : "Support tickets"
              : es
                ? "Estamos para ayudarte."
                : "We’re here to help."}
          </h1>
          <p>
            {staff
              ? es
                ? "Conversaciones, contexto del pedido y respuestas en un solo lugar."
                : "Conversations, order context and replies in one place."
              : es
                ? "Tus consultas y las respuestas de nuestro equipo, siempre a mano."
                : "Your requests and our team’s replies, all in one place."}
          </p>
        </div>
        <SimMascot variant="help" locale={locale} sizes="160px" />
      </div>
      {error && (
        <p className="support-error" role="alert">
          {error}
          <button onClick={() => void load()}>
            {es ? "Reintentar" : "Retry"}
          </button>
        </p>
      )}
      <div className="support-desk-grid">
        <aside className="support-ticket-list">
          <div className="support-list-heading">
            <h2>
              <Ticket size={20} />
              {es ? "Tickets" : "Tickets"} <span>{total}</span>
            </h2>
            <button
              className="support-icon-button"
              aria-label={es ? "Actualizar" : "Refresh"}
              onClick={() => void load()}
            >
              <RefreshCw size={18} />
            </button>
          </div>
          {!staff && (
            <button
              className="button button-primary"
              onClick={() => {
                setCreate(true);
                setBody("");
                setSubject("");
                request.current = null;
              }}
            >
              <Plus size={17} />
              {es ? "Nueva consulta" : "New request"}
            </button>
          )}
          <form
            className="support-search"
            onSubmit={(e) => {
              e.preventDefault();
              setSearch(query);
              setPage(1);
            }}
          >
            <Search size={17} />
            <input
              aria-label={es ? "Buscar tickets" : "Search tickets"}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              maxLength={80}
              placeholder={
                staff
                  ? es
                    ? "Tema, referencia o correo"
                    : "Subject, reference or email"
                  : es
                    ? "Tema o referencia"
                    : "Subject or reference"
              }
            />
            <button type="submit" aria-label={es ? "Buscar" : "Search"}>
              <ArrowRight size={17} />
            </button>
          </form>
          <label className="support-filter">
            {es ? "Estado" : "Status"}
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
            >
              <option value="">{es ? "Todos" : "All"}</option>
              {["open", "waiting_customer", "resolved"].map((s) => (
                <option key={s} value={s}>
                  {statusText(s, es)}
                </option>
              ))}
            </select>
          </label>
          <div className="support-ticket-rows" aria-busy={loading}>
            {rows.map((t) => (
              <button
                key={t.id}
                className={`support-ticket-row ${selected === t.id && !create ? "is-selected" : ""}`}
                onClick={() => select(t.id)}
                aria-current={selected === t.id && !create ? "true" : undefined}
              >
                <span className="support-ticket-ref">
                  {ticketReference(t.id)}
                  <time>
                    {new Date(t.updated_at).toLocaleDateString(
                      es ? "es-PA" : "en-US",
                      { month: "short", day: "numeric" },
                    )}
                  </time>
                </span>
                <strong>{t.subject}</strong>
                {staff && <small>{t.customer_email}</small>}
                <span className={`support-status support-status-${t.status}`}>
                  {statusText(t.status, es)}
                </span>
                {t.rating && (
                  <small>
                    {es ? "Valoración" : "Rating"}: {t.rating}/5
                  </small>
                )}
                {staff && t.notification_status && (
                  <small>
                    {es ? "Aviso por correo" : "Email notice"}:{" "}
                    {t.notification_status === "sent"
                      ? es
                        ? "enviado"
                        : "sent"
                      : t.notification_status === "failed"
                        ? es
                          ? "falló · revisar"
                          : "failed · review"
                        : es
                          ? "pendiente"
                          : "pending"}
                  </small>
                )}
              </button>
            ))}
            {!rows.length && !loading && (
              <p className="support-empty-small">
                {search || status
                  ? es
                    ? "No hay coincidencias."
                    : "No matches."
                  : es
                    ? "Aún no hay tickets."
                    : "No tickets yet."}
              </p>
            )}
          </div>
          {total > 20 && (
            <div className="support-pagination">
              <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                {es ? "Anterior" : "Previous"}
              </button>
              <span>
                {page} / {Math.ceil(total / 20)}
              </span>
              <button
                disabled={page * 20 >= total}
                onClick={() => setPage(page + 1)}
              >
                {es ? "Siguiente" : "Next"}
              </button>
            </div>
          )}
        </aside>
        <section
          className="support-ticket-content"
          aria-label={es ? "Conversación del ticket" : "Ticket conversation"}
        >
          {create && !staff ? (
            <>
              <div className="support-ticket-heading">
                <Headphones size={24} />
                <h2>{es ? "Cuéntanos qué sucede" : "Tell us what happened"}</h2>
                <p>
                  {es
                    ? "Tu consulta llegará a nuestro equipo. No incluyas contraseñas, tarjetas ni QR."
                    : "Your request goes to our team. Never include passwords, cards or QR codes."}
                </p>
              </div>
              <form
                className="support-ticket-form"
                onSubmit={(e) => void mutate("create", e)}
              >
                <label>
                  {es ? "Asunto" : "Subject"}
                  <input
                    required
                    minLength={3}
                    maxLength={120}
                    value={subject}
                    onChange={(e) => {
                      setSubject(e.target.value);
                      request.current = null;
                    }}
                  />
                </label>
                <label>
                  {es
                    ? "Pedido relacionado (opcional)"
                    : "Related order (optional)"}
                  <select
                    value={order}
                    onChange={(e) => {
                      setOrder(e.target.value);
                      request.current = null;
                    }}
                  >
                    <option value="">
                      {es ? "Consulta general" : "General question"}
                    </option>
                    {orders.map((o) => (
                      <option key={o.id} value={o.id}>
                        #{o.id.slice(0, 8).toUpperCase()} ·{" "}
                        {o.items[0]?.plan_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {es ? "Tu mensaje" : "Your message"}
                  <textarea
                    required
                    minLength={3}
                    maxLength={4000}
                    rows={6}
                    value={body}
                    onChange={(e) => {
                      setBody(e.target.value);
                      request.current = null;
                    }}
                  />
                </label>
                <div className="support-form-actions">
                  <button
                    className="button button-primary"
                    disabled={busy}
                    type="submit"
                  >
                    {busy ? <LoaderCircle size={18} /> : <Send size={18} />}{" "}
                    {es ? "Enviar consulta" : "Send request"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreate(false)}
                    disabled={busy}
                  >
                    {es ? "Cancelar" : "Cancel"}
                  </button>
                </div>
              </form>
            </>
          ) : detail ? (
            <>
              <header className="support-ticket-heading">
                <span className="support-eyebrow">
                  {ticketReference(detail.thread.id)}
                </span>
                <h2>{detail.thread.subject}</h2>
                <span
                  className={`support-status support-status-${detail.thread.status}`}
                >
                  {statusText(detail.thread.status, es)}
                </span>
                {detail.order && (
                  <div className="support-order-context">
                    <strong>
                      {es ? "Pedido" : "Order"} #{detail.order.reference}{" "}
                      {detail.order.test ? "· TEST" : ""}
                    </strong>
                    <span>
                      {detail.order.plans.map((p) => p.plan_name).join(" · ")}
                    </span>
                    <small>
                      {detail.order.paymentStatus} ·{" "}
                      {detail.order.esims
                        .map((u) => u.provider_status ?? u.state)
                        .join(", ")}
                    </small>
                  </div>
                )}
              </header>
              {detail.total > 50 && (
                <div className="support-pagination">
                  <button
                    disabled={messagePage * 50 >= detail.total}
                    onClick={() => setMessagePage(messagePage + 1)}
                  >
                    {es ? "Mensajes anteriores" : "Earlier messages"}
                  </button>
                  <span>{messagePage}</span>
                  <button
                    disabled={messagePage === 1}
                    onClick={() => setMessagePage(messagePage - 1)}
                  >
                    {es ? "Más recientes" : "More recent"}
                  </button>
                </div>
              )}
              <SupportMessages
                messages={detail.messages}
                es={es}
                staff={staff}
              />
              {detail.thread.status === "resolved" ? (
                <div className="support-closed-issue">
                  <ConversationRating
                    key={detail.thread.id}
                    thread={detail.thread}
                    locale={locale}
                    readOnly={staff}
                    onRated={(thread) => setDetail({ ...detail, thread })}
                  />
                  <p>
                    {es
                      ? "Esta incidencia está cerrada. Para otro problema, crea una nueva consulta."
                      : "This issue is closed. Create a new conversation for another problem."}
                  </p>
                  {!staff && (
                    <button
                      className="button button-primary"
                      onClick={() => {
                        setCreate(true);
                        setBody("");
                        setSubject("");
                        setOrder("");
                        request.current = null;
                      }}
                    >
                      <Plus size={17} />
                      {es ? "Nueva consulta" : "New conversation"}
                    </button>
                  )}
                </div>
              ) : (
                <form
                  className="support-ticket-form"
                  onSubmit={(e) => void mutate("reply", e)}
                >
                  <label>
                    {es ? "Tu respuesta" : "Your reply"}
                    <textarea
                      required
                      maxLength={4000}
                      rows={3}
                      value={body}
                      onChange={(e) => {
                        setBody(e.target.value);
                        request.current = null;
                      }}
                      disabled={busy}
                    />
                  </label>
                  <div className="support-form-actions">
                    <button
                      type="submit"
                      className="button button-primary"
                      disabled={busy || !body.trim()}
                    >
                      <Send size={17} />
                      {es ? "Enviar respuesta" : "Send reply"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void mutate("resolve")}
                    >
                      <CheckCircle2 size={17} />
                      {es ? "Marcar resuelto" : "Mark resolved"}
                    </button>
                  </div>
                  <p className="support-privacy">
                    {es
                      ? "Las respuestas quedan aquí. Te avisaremos por correo cuando el equipo responda."
                      : "Replies stay here. We will email you when the team responds."}
                  </p>
                </form>
              )}
            </>
          ) : (
            <div className="support-desk-empty">
              <div className="support-empty-icon">
                <Headphones size={32} />
              </div>
              <h2>
                {loading
                  ? es
                    ? "Cargando tus consultas…"
                    : "Loading your requests…"
                  : es
                    ? "Todo en un solo lugar"
                    : "Everything in one place"}
              </h2>
              <p>
                {es
                  ? "Selecciona un ticket para consultar la conversación y continuar con el equipo."
                  : "Select a ticket to read the conversation and continue with our team."}
              </p>
              {!staff && (
                <button
                  className="button button-secondary"
                  onClick={() => setCreate(true)}
                >
                  <Plus size={17} />
                  {es ? "Crear mi primera consulta" : "Create a request"}
                </button>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
