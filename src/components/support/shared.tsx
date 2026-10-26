"use client";
import Link from "next/link";
import type { SupportMessage } from "@/lib/support/model";
export function SupportMessages({
  messages,
  es,
  staff = false,
}: {
  messages: SupportMessage[];
  es: boolean;
  staff?: boolean;
}) {
  return (
    <div
      className="support-messages"
      aria-live="polite"
      aria-relevant="additions"
    >
      {messages.map((m) => (
        <article
          key={m.id}
          className={`support-message support-message-${m.author}`}
        >
          <small>
            {m.author === "user"
              ? staff
                ? es
                  ? "Cliente"
                  : "Customer"
                : es
                  ? "Tú"
                  : "You"
              : m.author === "agent"
                ? es
                  ? "Equipo MyTripSim"
                  : "MyTripSim team"
                : m.author === "assistant"
                  ? "SIM · AI"
                  : es
                    ? "Información"
                    : "Information"}
          </small>
          <p>{m.body}</p>
          {m.citations.length > 0 && (
            <div className="support-citations">
              {m.citations.map((c) => (
                <Link key={c.id} href={c.href}>
                  {c.title} ↗
                </Link>
              ))}
            </div>
          )}
          <time dateTime={m.created_at}>
            {new Date(m.created_at).toLocaleTimeString(es ? "es-PA" : "en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </time>
        </article>
      ))}
    </div>
  );
}
export async function supportFetch(url: string, init?: RequestInit) {
  const r = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error ?? "unavailable");
  return data;
}
export function supportError(e: unknown, es: boolean) {
  const code = e instanceof Error ? e.message : "";
  if (code === "conversation_closed")
    return es
      ? "La incidencia está cerrada. Puedes iniciar una nueva consulta."
      : "This issue is closed. You can start a new conversation.";
  if (code === "active_conversation")
    return es
      ? "Continúa o cierra tu conversación actual antes de empezar otra."
      : "Continue or close your current conversation before starting another.";
  if (code === "already_rated")
    return es
      ? "Ya recibimos tu valoración de esta incidencia."
      : "We already received your feedback for this issue.";
  if (code === "auth_required")
    return es ? "Inicia sesión para continuar." : "Sign in to continue.";
  if (code === "rate_limited")
    return es
      ? "Has enviado varias consultas. Inténtalo de nuevo más tarde."
      : "You have sent several requests. Please try again later.";
  if (code === "not_found")
    return es
      ? "No encontramos este ticket en tu cuenta."
      : "This ticket was not found in your account.";
  if (code === "ticket_active")
    return es
      ? "Este chat ya está en manos del equipo. Continúa en tus tickets."
      : "Our team is handling this chat. Continue in your tickets.";
  return es
    ? "No se pudo completar. Conservamos tu texto; vuelve a intentarlo."
    : "We could not complete this request. Your text is preserved; please try again.";
}
export const statusText = (status: string, es: boolean) =>
  ({
    chat: es ? "Chat con SIM" : "SIM chat",
    open: es ? "En revisión" : "Under review",
    waiting_customer: es ? "Respuesta del equipo" : "Team replied",
    resolved: es ? "Resuelto" : "Resolved",
  })[status] ?? status;
