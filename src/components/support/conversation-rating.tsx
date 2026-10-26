"use client";
import { useState } from "react";
import {
  CheckCircle2,
  Frown,
  Meh,
  Smile,
  Laugh,
  LoaderCircle,
} from "lucide-react";
import { supportThreadSchema, type SupportThread } from "@/lib/support/model";
import type { Locale } from "@/lib/i18n";
import { supportError, supportFetch } from "./shared";
export function ConversationRating({
  thread,
  locale,
  onRated,
  readOnly = false,
}: {
  thread: SupportThread;
  locale: Locale;
  onRated?: (thread: SupportThread) => void;
  readOnly?: boolean;
}) {
  const es = locale === "es",
    [score, setScore] = useState<number | null>(thread.rating ?? null),
    [comment, setComment] = useState(""),
    [saved, setSaved] = useState(!!thread.rating),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const labels = es
    ? ["Muy mala", "Mala", "Regular", "Buena", "Excelente"]
    : ["Very poor", "Poor", "Okay", "Good", "Excellent"];
  const icons = [Frown, Frown, Meh, Smile, Laugh];
  if (saved || readOnly)
    return thread.rating || saved ? (
      <div className="conversation-rating-saved" role="status">
        <CheckCircle2 size={20} />
        <div>
          <strong>
            {readOnly
              ? es
                ? "Valoración del cliente"
                : "Customer rating"
              : es
                ? "¡Gracias por tu valoración!"
                : "Thanks for your feedback!"}
          </strong>
          <p>
            {score ?? thread.rating}/5 ·{" "}
            {labels[(score ?? thread.rating ?? 1) - 1]}
          </p>
          {readOnly && thread.rating_comment && <p>{thread.rating_comment}</p>}
        </div>
      </div>
    ) : null;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!score || busy) return;
    setBusy(true);
    setError("");
    try {
      const d = await supportFetch("/api/support/conversations", {
        method: "POST",
        body: JSON.stringify({
          action: "rate",
          threadId: thread.id,
          rating: score,
          comment,
        }),
      });
      const updated = supportThreadSchema.parse(d.thread);
      setSaved(true);
      onRated?.(updated);
    } catch (e) {
      setError(supportError(e, es));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="conversation-rating"
      onSubmit={submit}
      aria-label={es ? "Valorar el soporte" : "Rate support"}
    >
      <h3>{es ? "¿Cómo te hemos ayudado?" : "How did we do?"}</h3>
      <p>
        {es
          ? "Tu opinión nos ayuda a mejorar. Es opcional."
          : "Your feedback helps us improve. It’s optional."}
      </p>
      <div
        className="conversation-rating-options"
        role="group"
        aria-label={es ? "Puntuación del soporte" : "Support score"}
      >
        {icons.map((Icon, index) => (
          <button
            type="button"
            key={index}
            disabled={busy}
            aria-label={`${index + 1}/5 · ${labels[index]}`}
            aria-pressed={score === index + 1}
            onClick={() => setScore(index + 1)}
          >
            <Icon size={27} />
            <span>{labels[index]}</span>
          </button>
        ))}
      </div>
      {score !== null && (
        <>
          <label>
            {es
              ? "¿Nos cuentas un poco más? (opcional)"
              : "Tell us a little more (optional)"}
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={600}
              rows={3}
              disabled={busy}
              placeholder={
                es
                  ? "Qué te gustó o qué podemos mejorar…"
                  : "What worked or what could be better…"
              }
            />
          </label>
          <button
            className="button button-primary"
            disabled={busy}
            type="submit"
          >
            {busy && <LoaderCircle size={16} />}{" "}
            {es ? "Enviar valoración" : "Send feedback"}
          </button>
        </>
      )}
      {error && (
        <p className="support-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
