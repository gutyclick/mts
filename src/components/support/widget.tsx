"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowUp,
  Headphones,
  LoaderCircle,
  MessageCircle,
  Ticket,
  X,
} from "lucide-react";
import { SimMascot } from "../sim-mascot";
import { supportMessageSchema, type SupportMessage } from "@/lib/support/model";
import { authPath } from "@/lib/auth-routes";
import { pathFor, type Locale } from "@/lib/i18n";
import { SupportMessages, supportError, supportFetch } from "./shared";
type Session = {
  authenticated: boolean;
  identity?: string;
  ai: boolean;
  chatId?: string | null;
  orders?: { id: string; status: string; items: { plan_name: string }[] }[];
};
export function SupportWidget({ locale }: { locale: Locale }) {
  const path = usePathname();
  return <WidgetDialog key={path} locale={locale} />;
}
function WidgetDialog({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false),
    dialog = useRef<HTMLDialogElement>(null),
    es = locale === "es";
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  return (
    <>
      <button
        className="support-launcher"
        onClick={() => setOpen(true)}
        aria-label={
          es
            ? "Hablar con SIM, asistente de ayuda"
            : "Chat with SIM, help assistant"
        }
        aria-haspopup="dialog"
      >
        <MessageCircle size={23} />
        <span>{es ? "¿Te ayudo?" : "Need help?"}</span>
      </button>
      <dialog
        ref={dialog}
        className="support-dialog"
        aria-labelledby="sim-chat-title"
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        {open && (
          <ChatPanel
            key={locale}
            locale={locale}
            close={() => setOpen(false)}
          />
        )}
      </dialog>
    </>
  );
}
function ChatPanel({ locale, close }: { locale: Locale; close: () => void }) {
  const es = locale === "es",
    [session, setSession] = useState<Session | null>(null),
    [messages, setMessages] = useState<SupportMessage[]>([]),
    [thread, setThread] = useState<string>(),
    [body, setBody] = useState(""),
    [order, setOrder] = useState(""),
    [language, setLanguage] = useState("auto"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [human, setHuman] = useState(false),
    [ticketBody, setTicketBody] = useState(""),
    [ticket, setTicket] = useState<string>(),
    tail = useRef<HTMLDivElement>(null),
    controller = useRef<AbortController | null>(null),
    requestId = useRef<string | null>(null);
  useEffect(() => {
    const abort = new AbortController();
    let identity: string | undefined,
      ready = false;
    controller.current = abort;
    const load = async () => {
      try {
        const s = (await supportFetch("/api/support/session", {
          signal: abort.signal,
        })) as Session;
        if (abort.signal.aborted) return;
        identity = s.identity;
        ready = true;
        setSession(s);
        if (s.chatId) {
          const d = await supportFetch(`/api/support/tickets?id=${s.chatId}`, {
            signal: abort.signal,
          });
          if (abort.signal.aborted) return;
          setThread(d.thread.id);
          setOrder(d.thread.order_id ?? "");
          setMessages(
            d.messages.map((m: unknown) => supportMessageSchema.parse(m)),
          );
        }
      } catch (e) {
        if (!abort.signal.aborted) setError(supportError(e, es));
      }
    };
    void load();
    const check = async () => {
      if (!ready || document.visibilityState !== "visible") return;
      try {
        const s = await supportFetch("/api/support/session", {
          signal: abort.signal,
        });
        if (s.identity !== identity) close();
      } catch {
        close();
      }
    };
    const onFocus = () => void check(),
      timer = setInterval(onFocus, 30000);
    window.addEventListener("focus", onFocus);
    return () => {
      abort.abort();
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [es, close]);
  useEffect(() => {
    tail.current?.scrollIntoView({ block: "end", behavior: "instant" });
  }, [messages, busy, human, ticket]);
  async function send(e: React.FormEvent, mode: "chat" | "ticket" = "chat") {
    e.preventDefault();
    const creatingTicket = mode === "ticket",
      text = (creatingTicket ? ticketBody : body).trim();
    if (
      creatingTicket !== human ||
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
      if (creatingTicket) {
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
        setThread(d.threadId ?? undefined);
        setBody("");
        requestId.current = null;
      }
    } catch (err) {
      if (!controller.current?.signal.aborted) setError(supportError(err, es));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="support-chat-header">
        <div className="support-avatar">
          <SimMascot variant="help" locale={locale} sizes="64px" />
        </div>
        <div>
          <h2 id="sim-chat-title">
            SIM {es ? "te acompaña" : "is here to help"}
          </h2>
          <p>
            {es ? "Tu asistente de viaje · IA" : "Your travel assistant · AI"}
          </p>
        </div>
        <button
          onClick={close}
          className="support-icon-button"
          aria-label={es ? "Cerrar chat" : "Close chat"}
        >
          <X size={22} />
        </button>
      </header>
      <div className="support-chat-scroll">
        <div className="support-welcome">
          <p>
            <strong>{es ? "¡Hola, viajero! 👋" : "Hello, traveler! 👋"}</strong>
          </p>
          <p>
            {es
              ? "Te ayudo con tu eSIM, la instalación y las dudas de tu viaje."
              : "I can help with your eSIM, installation and travel questions."}
          </p>
        </div>
        <p className="support-privacy">
          {es
            ? "SIM usa IA y puede equivocarse. No compartas contraseñas, tarjetas ni QR."
            : "SIM uses AI and may make mistakes. Never share passwords, cards or QR codes."}{" "}
          <Link href={pathFor(locale, "privacy")}>
            {es ? "Privacidad" : "Privacy"}
          </Link>
        </p>
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
                ["es", "Español"],
                ["en", "English"],
                ["pt", "Português"],
                ["fr", "Français"],
                ["de", "Deutsch"],
                ["it", "Italiano"],
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
        {!messages.length && !human && (
          <div className="support-suggestions">
            {(es
              ? [
                  "¿Cómo instalo mi eSIM?",
                  "¿Debo activar la itinerancia?",
                  "¿Puedo compartir internet?",
                ]
              : [
                  "How do I install my eSIM?",
                  "Should I enable data roaming?",
                  "Can I use a hotspot?",
                ]
            ).map((t) => (
              <button
                key={t}
                disabled={busy}
                onClick={() => {
                  setBody(t);
                  requestId.current = null;
                }}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        <SupportMessages messages={messages} es={es} />
        {busy && (
          <p className="support-thinking" role="status">
            <LoaderCircle size={17} />
            {es ? "Un momento…" : "One moment…"}
          </p>
        )}
        {human && !ticket && (
          <div className="support-human-card">
            <Headphones size={22} />
            <h3>{es ? "Hablemos con el equipo" : "Let’s ask the team"}</h3>
            <p>
              {es
                ? session?.authenticated
                  ? "Guardaremos esta conversación con tu consulta. Podrás ver las respuestas en tus tickets."
                  : "Inicia sesión para enviar una consulta y ver las respuestas en tu cuenta. El chat de visitante no se guarda."
                : session?.authenticated
                  ? "We will save this conversation with your request. You can read replies in your tickets."
                  : "Sign in to send a request and read replies in your account. Guest chat is not saved."}
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
        {ticket && (
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
        {error && (
          <p className="support-error" role="alert">
            {error}
          </p>
        )}
        <div ref={tail} />
      </div>
      {!ticket && (
        <footer className="support-chat-footer">
          <form
            id="sim-chat-form"
            onSubmit={send}
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
        </footer>
      )}
    </>
  );
}
