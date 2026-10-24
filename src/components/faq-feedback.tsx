"use client";
import { useId, useState, useSyncExternalStore } from "react";
import {
  ArrowUpRight,
  Check,
  Clipboard,
  LifeBuoy,
  ShieldCheck,
  ThumbsUp,
} from "lucide-react";
import {
  feedbackCopy,
  feedbackKey,
  parseFAQVote,
  type FAQVote,
} from "@/lib/faq-feedback";
import type { FAQQuestion } from "@/lib/help-content";
import type { Locale } from "@/lib/i18n";
import { faqQuestionPath } from "@/lib/faq-links";

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("mytripsim:faq-vote", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("mytripsim:faq-vote", callback);
  };
}
function readVote(id: string) {
  try {
    return parseFAQVote(window.localStorage.getItem(feedbackKey(id)));
  } catch {
    return null;
  }
}
export function FAQFeedback({
  locale,
  question,
  related,
}: {
  locale: Locale;
  question: FAQQuestion;
  related: FAQQuestion[];
}) {
  const c = feedbackCopy[locale];
  const id = useId();
  const stored = useSyncExternalStore(
    subscribe,
    () => readVote(question.id),
    () => null,
  );
  const [temporary, setTemporary] = useState<FAQVote | null>(null);
  const [copyStatus, setCopyStatus] = useState<"copied" | "failed" | null>(
    null,
  );
  const choice = temporary ?? stored;
  const summary = `${question.question}\n\n${c.device}: \n${c.destination}: \n${c.issue}: \n\n${c.reference}: ${faqQuestionPath(locale, question.id)}`;
  function vote(value: FAQVote) {
    try {
      window.localStorage.setItem(feedbackKey(question.id), value);
      setTemporary(null);
      window.dispatchEvent(new Event("mytripsim:faq-vote"));
    } catch {
      setTemporary(value);
    }
  }
  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopyStatus("copied");
    } catch {
      setCopyStatus("failed");
    }
  }
  return (
    <div className="faq-feedback">
      <div className="faq-feedback-row">
        <span className="faq-feedback-prompt" id={`${id}-prompt`}>
          {c.prompt}
        </span>
        <div
          className="faq-feedback-actions"
          role="group"
          aria-labelledby={`${id}-prompt`}
        >
          <button
            type="button"
            aria-pressed={choice === "helpful"}
            onClick={() => vote("helpful")}
          >
            <ThumbsUp size={16} />
            {c.yes}
          </button>
          <button
            type="button"
            aria-pressed={choice === "more-help"}
            aria-expanded={choice === "more-help"}
            aria-controls={`${id}-help`}
            onClick={() => vote("more-help")}
          >
            <LifeBuoy size={16} />
            {c.more}
          </button>
        </div>
      </div>
      <div className="faq-feedback-status" role="status">
        {choice === "helpful" && (
          <span className="faq-thanks">
            <Check size={16} />
            {c.thanks}
          </span>
        )}
        <span>{temporary ? c.temporary : c.local}</span>
      </div>
      <section
        className="faq-next-step"
        id={`${id}-help`}
        hidden={choice !== "more-help"}
        aria-labelledby={`${id}-title`}
      >
        <div className="faq-next-step-heading">
          <LifeBuoy size={22} />
          <h3 id={`${id}-title`}>{c.title}</h3>
        </div>
        <p>{c.description}</p>
        <h4>{c.related}</h4>
        <div className="faq-related">
          {related.map((item) => (
            <a key={item.id} href={faqQuestionPath(locale, item.id)}>
              {item.question}
              <ArrowUpRight size={17} />
            </a>
          ))}
        </div>
        <label className="faq-summary-label" htmlFor={`${id}-summary`}>
          {c.summary}
        </label>
        <textarea id={`${id}-summary`} readOnly value={summary} rows={6} />
        <button
          type="button"
          className="button button-secondary faq-copy"
          onClick={copy}
        >
          <Clipboard size={17} />
          {c.copy}
        </button>
        <div role="status" className="faq-copy-status">
          {copyStatus && (copyStatus === "copied" ? c.copied : c.copyFailed)}
        </div>
        <small className="faq-privacy">
          <ShieldCheck size={16} />
          {c.privacy}
        </small>
      </section>
    </div>
  );
}
