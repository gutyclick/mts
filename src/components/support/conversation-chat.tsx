"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  Headphones,
  LoaderCircle,
  Ticket,
  CheckCircle2,
  Plus,
} from "lucide-react";
import { MessengerHeader } from "./messenger-header";
import { ConversationRating } from "./conversation-rating";
import {
  conversationDeadline,
  conversationOpening,
} from "@/lib/support/conversations";
import { supportThreadSchema } from "@/lib/support/model";
import type { MessengerSession, ConversationDetail } from "./messenger-types";
import { supportMessageSchema, type SupportMessage } from "@/lib/support/model";
import { authPath } from "@/lib/auth-routes";
import { pathFor, type Locale } from "@/lib/i18n";
import { SupportMessages, supportError, supportFetch } from "./shared";
export function ConversationChat({
  locale,
  close,
  onHome,
  session: initialSession,
  detail,
}: {
  locale: Locale;
  close: () => void;
  onHome: () => void;
  session: MessengerSession;
  detail: ConversationDetail;
}) {
  const es = locale === "es",
    [session] = useState(initialSession),
    [current, setCurrent] = useState(detail.thread),
    [messages, setMessages] = useState<SupportMessage[]>(detail.messages),
    [thread] = useState(detail.thread.id),
    [body, setBody] = useState(""),
    [order, setOrder] = useState(detail.thread.order_id ?? ""),
    [language, setLanguage] = useState(detail.thread.language ?? "auto"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [human, setHuman] = useState(false),
    [ticketBody, setTicketBody] = useState(""),
    [ticket, setTicket] = useState<string | undefined>(
      detail.thread.escalated_at ? detail.thread.id : undefined,
    ),
    tail = useRef<HTMLDivElement>(null),
    controller = useRef<AbortController | null>(null),
    requestId = useRef<string | null>(null);
  const closed = current.status === "resolved";
  const busyRef = useRef(false);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);
  const clockOffset = useRef(0);
  useEffect(() => {
    clockOffset.current = detail.serverTime
      ? new Date(detail.serverTime).getTime() - Date.now()
      : 0;
  }, [detail.serverTime]);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const d = await supportFetch("/api/support/conversations?id=" + thread, {
        signal,
      });
      if (signal?.aborted) return;
      if (d.serverTime)
        clockOffset.current = new Date(d.serverTime).getTime() - Date.now();
      setCurrent(supportThreadSchema.parse(d.thread));
      setMessages(
        d.messages.map((m: unknown) => supportMessageSchema.parse(m)),
      );
      if (d.thread.escalated_at) setTicket(thread);
    },
    [thread],
  );
  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    const check = async () => {
      if (busyRef.current || document.visibilityState !== "visible") return;
      try {
        const s = await supportFetch("/api/support/session", {
          signal: abort.signal,
        });
        if (s.identity !== initialSession.identity) {
          close();
          return;
        }
        await refresh(abort.signal);
      } catch (e) {
        if (!abort.signal.aborted) setError(supportError(e, es));
      }
    };
    const timer = setInterval(() => void check(), 15000);
    window.addEventListener("focus", check);
    return () => {
      abort.abort();
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [thread, close, initialSession.identity, es, refresh]);
  const finish = useCallback(
    async (reason: "resolved" | "inactivity") => {
      if (busyRef.current) return;
      setBusy(true);
      setError("");
      try {
        await supportFetch("/api/support/conversations", {
          method: "POST",
          body: JSON.stringify({ action: "close", threadId: thread, reason }),
        });
        await refresh(controller.current?.signal);
      } catch (e) {
        if (!controller.current?.signal.aborted) setError(supportError(e, es));
      } finally {
        setBusy(false);
      }
    },
    [thread, refresh, es],
  );
  useEffect(() => {
    if (current.status !== "chat" || busy) return;
    const timeout = setTimeout(
      () => void finish("inactivity"),
      Math.max(
        1000,
        new Date(
          conversationDeadline(current.updated_at, detail.idleSeconds),
        ).getTime() -
          (Date.now() + clockOffset.current),
      ) + 100,
    );
    return () => clearTimeout(timeout);
  }, [current.status, current.updated_at, busy, detail.idleSeconds, finish]);
  useEffect(() => {
    tail.current?.scrollIntoView({ block: "end", behavior: "instant" });
  }, [messages, busy, human, ticket]);
  async function send(
    e: React.FormEvent,
    mode: "chat" | "ticket" | "reply" = "chat",
  ) {
    e.preventDefault();
    const creatingTicket = mode === "ticket",
      text = (creatingTicket ? ticketBody : body).trim();
    if (
      closed ||
      (mode !== "reply" && creatingTicket !== human) ||
      text.length < (creatingTicket ? 3 : 1) ||
      busy ||
      !session ||
      (creatingTicket && !session.authenticated)
    )
      return;
    setBusy(true);
    setError("");
    requestId.current ??= crypto.randomUUID();
    try {
      if (mode === "reply") {
        await supportFetch("/api/support/tickets", {
          method: "POST",
          signal: controller.current?.signal,
          body: JSON.stringify({
            locale,
            request: {
              action: "reply",
              requestId: requestId.current,
              threadId: thread,
              body: text,
            },
          }),
        });
        setBody("");
        requestId.current = null;
        await refresh(controller.current?.signal);
      } else if (creatingTicket) {
        const subject = (
          text
            .split(/\r?\n/)
            .find((line) => line.trim().length >= 3)
            ?.trim() ?? text.replace(/\s+/g, " ")
        ).slice(0, 120);
        const d = await supportFetch("/api/support/tickets", {
          method: "POST",
          signal: controller.current?.signal,
          body: JSON.stringify({
            locale,
            request: {
              action: "create",
              requestId: requestId.current,
              threadId: thread,
              subject,
              body: text,
              language,
              ...(order ? { orderId: order } : {}),
            },
          }),
        });
        setTicket(d.id);
        setHuman(false);
        await refresh(controller.current?.signal);
        setBody("");
        setTicketBody("");
        requestId.current = null;
      } else {
        const d = await supportFetch("/api/support/chat", {
          method: "POST",
          signal: controller.current?.signal,
          body: JSON.stringify({
            requestId: requestId.current,
            threadId: thread,
            message: text,
            language,
            locale,
            ...(order ? { orderId: order } : {}),
            history: session.authenticated
              ? []
              : messages
                  .filter(
                    (m) => m.author === "user" || m.author === "assistant",
                  )
                  .slice(-6)
                  .map((m) => ({ role: m.author, body: m.body })),
          }),
        });
        const m = supportMessageSchema.parse(d.message);
        setMessages((prev) => [
          ...prev,
          {
            id: requestId.current!,
            thread_id: d.threadId ?? crypto.randomUUID(),
            author: "user",
            body: text,
            citations: [],
            created_at: new Date().toISOString(),
          },
          m,
        ]);
        if (d.thread) setCurrent(supportThreadSchema.parse(d.thread));
        setBody("");
        requestId.current = null;
      }
    } catch (err) {
      if (!controller.current?.signal.aborted) {
        setError(supportError(err, es));
        if (err instanceof Error && err.message === "conversation_closed")
          await refresh(controller.current?.signal);
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <MessengerHeader
        locale={locale}
        ai={session.ai && !closed}
        close={close}
        back={onHome}
      />
      <div className="support-chat-scroll">
        <div className="conversation-toolbar">
          <span>{current.subject}</span>
          {!closed && (
            <button disabled={busy} onClick={() => void finish("resolved")}>
              <CheckCircle2 size={16} />
              {es ? "Cerrar incidencia" : "Close issue"}
            </button>
          )}
        </div>
        <div className="support-welcome" role="note">
          <p>
            <strong>SIM</strong>
          </p>
          <p>{conversationOpening(locale, current.topic)}</p>
        </div>
        {!closed && (
          <div className="support-chat-options">
            <label>
              {es ? "Idioma de respuesta" : "Response language"}
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                disabled={busy}
              >
                <option value="auto">{es ? "Automático" : "Automatic"}</option>
                {[
                  ["es", es ? "Español" : "Spanish"],
                  ["en", es ? "Inglés" : "English"],
                  ["pt", es ? "Portugués" : "Portuguese"],
                  ["fr", es ? "Francés" : "French"],
                  ["de", es ? "Alemán" : "German"],
                  ["it", es ? "Italiano" : "Italian"],
                ].map(([v, n]) => (
                  <option key={v} value={v}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            {session?.authenticated && (
              <label>
                {es ? "Sobre un pedido" : "About an order"}
                <select
                  value={order}
                  disabled={busy}
                  onChange={(e) => {
                    setOrder(e.target.value);
                    requestId.current = null;
                  }}
                >
                  <option value="">
                    {es ? "Consulta general" : "General question"}
                  </option>
                  {session.orders?.map((o) => (
                    <option key={o.id} value={o.id}>
                      #{o.id.slice(0, 8).toUpperCase()} ·{" "}
                      {o.items[0]?.plan_name ?? o.status}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
        <SupportMessages messages={messages} es={es} />
        {busy && (
          <p className="support-thinking" role="status">
            <LoaderCircle size={17} />
            {es ? "Un momento…" : "One moment…"}
          </p>
        )}
        {!closed && human && !ticket && (
          <div className="support-human-card">
            <Headphones size={22} />
            <h3>{es ? "Hablemos con el equipo" : "Let’s ask the team"}</h3>
            <p>
              {es
                ? session?.authenticated
                  ? "Guardaremos esta conversación con tu consulta. Podrás ver las respuestas en tus tickets."
                  : "Inicia sesión para enviar una consulta y ver las respuestas en tu cuenta. Puedes retomar este chat desde este navegador."
                : session?.authenticated
                  ? "We will save this conversation with your request. You can read replies in your tickets."
                  : "Sign in to send a request and read replies in your account. You can resume this chat in this browser."}
            </p>
            {!session?.authenticated ? (
              <Link
                className="button button-primary"
                href={`${authPath(locale, "login")}?next=/${locale}/support`}
              >
                {es ? "Iniciar sesión y pedir ayuda" : "Sign in and get help"}
              </Link>
            ) : (
              <form
                className="support-escalation-form"
                onSubmit={(e) => send(e, "ticket")}
              >
                <label>
                  {es
                    ? "¿Con qué necesitas ayuda?"
                    : "What do you need help with?"}
                  <textarea
                    value={ticketBody}
                    minLength={3}
                    maxLength={4000}
                    rows={4}
                    required
                    disabled={busy}
                    autoFocus
                    onChange={(e) => {
                      setTicketBody(e.target.value);
                      requestId.current = null;
                    }}
                    placeholder={
                      es ? "Ej. No consigo conectarme" : "e.g. I cannot connect"
                    }
                  />
                </label>
                <button
                  className="button button-primary"
                  type="submit"
                  disabled={busy || ticketBody.trim().length < 3}
                >
                  {busy ? <LoaderCircle size={17} /> : <Ticket size={17} />}{" "}
                  {es ? "Crear ticket" : "Create ticket"}
                </button>
                <small>
                  {es
                    ? "Continuarás con el equipo desde Mis tickets."
                    : "Continue with our team in My tickets."}
                </small>
              </form>
            )}
          </div>
        )}
        {!closed && ticket && (
          <div className="support-human-card" role="status">
            <Ticket size={25} />
            <h3>{es ? "Tu ticket está creado" : "Your ticket is ready"}</h3>
            <p>
              {es
                ? "El equipo recibirá tu consulta. El historial queda en tu cuenta."
                : "The team will receive your request. Your account keeps the history."}
            </p>
            <Link
              className="button button-primary"
              href={`/${locale}/support?ticket=${ticket}`}
            >
              {es ? "Ver mi ticket" : "View my ticket"}
            </Link>
          </div>
        )}
        {closed && (
          <section className="conversation-ended">
            <span className="conversation-ended-icon">
              <CheckCircle2 size={24} />
            </span>
            <h3>
              {es ? "Esta incidencia está cerrada" : "This issue is closed"}
            </h3>
            <p>
              {current.close_reason === "inactivity"
                ? es
                  ? "Finalizó tras un tiempo sin mensajes. Puedes consultar el historial o empezar otra consulta."
                  : "It ended after a period without messages. Read your history or start another question."
                : es
                  ? "El historial queda guardado. Cuando quieras, podemos ayudarte con otro tema."
                  : "Your history is saved. We can help with another topic whenever you need."}
            </p>
            {messages.some((m) => m.author === "user") && (
              <ConversationRating
                key={current.id}
                thread={current}
                locale={locale}
                onRated={setCurrent}
              />
            )}
          </section>
        )}
        {error && (
          <p className="support-error" role="alert">
            {error}
          </p>
        )}
        <div ref={tail} />
      </div>
      <footer className="support-chat-footer">
        {closed ? (
          <button
            className="button button-primary messenger-new"
            onClick={onHome}
          >
            <Plus size={17} />
            {es ? "Nueva consulta" : "New conversation"}
          </button>
        ) : (
          <>
            <form
              id="sim-chat-form"
              onSubmit={(e) => send(e, ticket ? "reply" : "chat")}
              className={`support-composer${human ? " is-paused" : ""}`}
            >
              <textarea
                aria-label={es ? "Tu mensaje" : "Your message"}
                value={human ? "" : body}
                onChange={(e) => {
                  setBody(e.target.value);
                  requestId.current = null;
                }}
                maxLength={3000}
                rows={2}
                required
                minLength={1}
                disabled={busy || human}
                aria-describedby={human ? "sim-chat-paused" : undefined}
                placeholder={
                  human
                    ? es
                      ? "Crea tu ticket en el recuadro de arriba."
                      : "Create your ticket in the box above."
                    : es
                      ? "Escribe tu consulta…"
                      : "Write your question…"
                }
              />
              <button
                type="submit"
                disabled={busy || human || !session || !body.trim()}
                aria-label={es ? "Enviar mensaje" : "Send message"}
              >
                <ArrowUp size={21} />
              </button>
            </form>
            {human && (
              <p
                id="sim-chat-paused"
                className="support-paused-note"
                role="status"
              >
                {es
                  ? "El chat está en pausa mientras creas tu ticket."
                  : "Chat is paused while you create your ticket."}
              </p>
            )}
            {!ticket && (
              <div className="support-footer-links">
                <button
                  onClick={() => {
                    if (!human) setTicketBody((previous) => previous || body);
                    setHuman(!human);
                    setError("");
                    requestId.current = null;
                  }}
                  disabled={busy}
                >
                  <Headphones size={15} />
                  {human
                    ? es
                      ? "Volver al chat"
                      : "Back to chat"
                    : es
                      ? "Necesito ayuda humana"
                      : "I need human help"}
                </button>
                <Link href={`/${locale}/support`}>
                  <Ticket size={15} />
                  {es ? "Mis tickets" : "My tickets"}
                </Link>
              </div>
            )}
            {ticket && (
              <Link
                className="messenger-ticket-link"
                href={`/${locale}/support?ticket=${ticket}`}
              >
                {es
                  ? "Ver incidencia en Mis tickets"
                  : "View issue in My tickets"}
              </Link>
            )}
            {current.status === "chat" && (
              <p className="messenger-idle-note">
                {es
                  ? `Se cierra tras ${Math.round(detail.idleSeconds / 60)} min sin mensajes.`
                  : `Closes after ${Math.round(detail.idleSeconds / 60)} min without messages.`}
              </p>
            )}
          </>
        )}
        <p className="support-ai-disclosure">
          {es
            ? "SIM usa IA y puede equivocarse. No compartas datos privados."
            : "SIM uses AI and may make mistakes. Don’t share private details."}{" "}
          <Link href={pathFor(locale, "privacy")}>
            {es ? "Privacidad" : "Privacy"}
          </Link>
        </p>
      </footer>
    </>
  );
}
