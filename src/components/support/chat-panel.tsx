"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Globe2,
  History,
  LoaderCircle,
  MessageCircle,
  Plus,
  QrCode,
  Smartphone,
  Wifi,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { pathFor } from "@/lib/i18n";
import {
  conversationTopicNames,
  conversationTopics,
  type ConversationTopic,
} from "@/lib/support/conversations";
import { supportThreadSchema } from "@/lib/support/model";
import { ConversationChat } from "./conversation-chat";
import { MessengerHeader } from "./messenger-header";
import type { MessengerSession, ConversationDetail } from "./messenger-types";
import { statusText, supportError, supportFetch } from "./shared";
const topicIcons = {
  general: MessageCircle,
  installation: QrCode,
  connection: Wifi,
  plans: Globe2,
  orders: CreditCard,
  compatibility: Smartphone,
};
export function ChatPanel({
  locale,
  close,
}: {
  locale: Locale;
  close: () => void;
}) {
  const es = locale === "es",
    [session, setSession] = useState<MessengerSession | null>(null),
    [detail, setDetail] = useState<ConversationDetail | null>(null),
    [view, setView] = useState<"home" | "history" | "thread">("home"),
    [busy, setBusy] = useState(true),
    [error, setError] = useState("");
  const load = useCallback(
    async (resume = false, signal?: AbortSignal) => {
      try {
        const d = await supportFetch("/api/support/session", { signal });
        if (signal?.aborted) return;
        setError("");
        const next = {
          ...d,
          conversations: (d.conversations ?? []).map((t: unknown) =>
            supportThreadSchema.parse(t),
          ),
          idleSeconds: d.idleSeconds ?? 600,
        } as MessengerSession;
        setSession(next);
        if (resume && next.chatId) {
          const t = await supportFetch(
            "/api/support/conversations?id=" + next.chatId,
            { signal },
          );
          if (signal?.aborted) return;
          setDetail(t);
          setView("thread");
        }
      } catch (e) {
        if (!signal?.aborted) setError(supportError(e, es));
      } finally {
        if (!signal?.aborted) setBusy(false);
      }
    },
    [es],
  );
  useEffect(() => {
    const abort = new AbortController();
    void Promise.resolve().then(() => load(true, abort.signal));
    return () => abort.abort();
  }, [load]);
  async function start(topic: ConversationTopic) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const d = await supportFetch("/api/support/conversations", {
        method: "POST",
        body: JSON.stringify({
          action: "start",
          requestId: crypto.randomUUID(),
          topic,
          locale,
        }),
      });
      setDetail(d);
      setView("thread");
    } catch (e) {
      setError(supportError(e, es));
      if (e instanceof Error && e.message === "active_conversation")
        await load(false);
    } finally {
      setBusy(false);
    }
  }
  async function select(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setDetail(await supportFetch("/api/support/conversations?id=" + id));
      setView("thread");
    } catch (e) {
      setError(supportError(e, es));
    } finally {
      setBusy(false);
    }
  }
  const home = () => {
    setDetail(null);
    setView("home");
    void load(false);
  };
  if (view === "thread" && detail && session)
    return (
      <ConversationChat
        key={detail.thread.id}
        detail={detail}
        session={session}
        locale={locale}
        close={close}
        onHome={home}
      />
    );
  const active = session?.conversations.find((t) => t.status === "chat");
  return (
    <>
      <MessengerHeader locale={locale} ai={!!session?.ai} close={close} />
      <nav
        className="messenger-tabs"
        aria-label={es ? "Secciones de ayuda" : "Help sections"}
      >
        <button
          aria-current={view === "home" ? "page" : undefined}
          onClick={() => setView("home")}
        >
          <MessageCircle size={17} />
          {es ? "Ayuda" : "Help"}
        </button>
        <button
          aria-current={view === "history" ? "page" : undefined}
          onClick={() => {
            setView("history");
            void load(false);
          }}
        >
          <History size={17} />
          {es ? "Conversaciones" : "Conversations"}
        </button>
      </nav>
      <div className="support-chat-scroll messenger-home-scroll">
        {busy && (
          <p className="support-thinking" role="status">
            <LoaderCircle size={18} />
            {es ? "Preparando tu ayuda…" : "Getting your help ready…"}
          </p>
        )}
        {error && (
          <div className="support-error" role="alert">
            <p>{error}</p>
            <button onClick={() => void load(false)}>
              {es ? "Reintentar" : "Try again"}
            </button>
          </div>
        )}
        {view === "home" ? (
          <>
            <div className="messenger-intro">
              <span className="eyebrow">
                {es ? "CADA VIAJE, MÁS FÁCIL" : "EVERY TRIP, A LITTLE EASIER"}
              </span>
              <h3>{es ? "¿En qué te ayudamos?" : "How can we help?"}</h3>
              <p>
                {es
                  ? "Elige un tema y cuéntanos qué sucede."
                  : "Choose a topic and tell us what’s happening."}
              </p>
            </div>
            {active ? (
              <section className="messenger-resume">
                <span className="messenger-mini-icon">
                  <MessageCircle size={21} />
                </span>
                <div>
                  <strong>
                    {es
                      ? "Tienes una conversación abierta"
                      : "You have an open conversation"}
                  </strong>
                  <p>{active.subject}</p>
                </div>
                <button
                  className="button button-primary"
                  disabled={busy}
                  onClick={() => void select(active.id)}
                >
                  {es ? "Continuar conversación" : "Continue conversation"}
                  <ArrowRight size={16} />
                </button>
                <small>
                  {es
                    ? "Puedes cerrarla desde el chat para empezar otro tema."
                    : "Close it from the chat to start another topic."}
                </small>
              </section>
            ) : (
              <div className="messenger-topic-grid">
                {conversationTopics.map((topic) => {
                  const Icon = topicIcons[topic];
                  return (
                    <button
                      key={topic}
                      disabled={busy || !session}
                      onClick={() => void start(topic)}
                    >
                      <span>
                        <Icon size={21} />
                      </span>
                      <strong>{conversationTopicNames[locale][topic]}</strong>
                      <ArrowRight size={16} />
                    </button>
                  );
                })}
              </div>
            )}
            {session && session.conversations.length > 0 && (
              <button
                className="messenger-history-link"
                onClick={() => setView("history")}
              >
                <History size={18} />
                {es ? "Ver mis conversaciones" : "View my conversations"}
                <ArrowRight size={16} />
              </button>
            )}
          </>
        ) : (
          <section className="messenger-history">
            <div className="messenger-history-heading">
              <h3>{es ? "Tus conversaciones" : "Your conversations"}</h3>
              {!active && (
                <button onClick={() => setView("home")}>
                  <Plus size={16} />
                  {es ? "Nueva" : "New"}
                </button>
              )}
            </div>
            {!session?.conversations.length && !busy && (
              <div className="messenger-empty">
                <MessageCircle size={30} />
                <h4>
                  {es
                    ? "Tu próxima consulta empieza aquí"
                    : "Your next question starts here"}
                </h4>
                <p>
                  {es
                    ? "Aquí encontrarás el historial de tus incidencias."
                    : "Your conversation history will appear here."}
                </p>
                <button
                  className="button button-primary"
                  onClick={() => setView("home")}
                >
                  {es ? "Nueva consulta" : "New conversation"}
                </button>
              </div>
            )}
            <ul>
              {session?.conversations.map((t) => (
                <li key={t.id}>
                  <button disabled={busy} onClick={() => void select(t.id)}>
                    <span
                      className={`messenger-history-icon ${t.status === "resolved" ? "is-closed" : ""}`}
                    >
                      {t.status === "resolved" ? (
                        <CheckCircle2 size={21} />
                      ) : (
                        <MessageCircle size={21} />
                      )}
                    </span>
                    <span>
                      <strong>{t.subject}</strong>
                      <small>
                        {statusText(t.status, es)} ·{" "}
                        {new Date(t.updated_at).toLocaleDateString(locale, {
                          day: "numeric",
                          month: "short",
                        })}
                      </small>
                      {t.rating && (
                        <small className="messenger-history-rating">
                          {es ? "Tu valoración" : "Your rating"}: {t.rating}/5
                        </small>
                      )}
                    </span>
                    <ArrowRight size={16} />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <footer className="messenger-home-footer">
        <Link href={pathFor(locale, "faq")}>
          {es ? "Explorar el centro de ayuda" : "Explore the help center"}
          <ArrowRight size={15} />
        </Link>
        <p>
          {es
            ? "Guardamos el historial para que puedas retomarlo. No compartas datos privados."
            : "We save your history so you can return to it. Don’t share private information."}
        </p>
      </footer>
    </>
  );
}
