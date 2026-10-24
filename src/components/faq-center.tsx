"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Info, Plus, Search, X } from "lucide-react";
import { helpContent, type FAQQuestion } from "@/lib/help-content";
import { normalize } from "@/lib/text";
import type { Locale } from "@/lib/i18n";
import { FAQFeedback } from "./faq-feedback";
import { helpTopicIcons } from "./help-topic-icons";

export function FAQCenter({ locale }: { locale: Locale }) {
  const c = helpContent[locale];
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const [target, setTarget] = useState<{ id: string } | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const allQuestions = c.categories.flatMap((category) => category.questions);
  const categories = c.categories
    .filter((category) => topic === "all" || category.id === topic)
    .map((category) => ({
      ...category,
      questions: category.questions.filter((item) =>
        normalize(
          [
            item.question,
            item.answer,
            ...(item.steps ?? []),
            item.note ?? "",
          ].join(" "),
        ).includes(normalize(query)),
      ),
    }))
    .filter((category) => category.questions.length);
  function navigate(id: string) {
    setQuery("");
    setTopic("all");
    setTarget({ id });
  }
  useEffect(() => {
    const openHash = () => {
      const hash = window.location.hash.slice(1);
      if (hash.startsWith("faq-")) {
        const id = hash.slice(4);
        if (
          helpContent[locale].categories.some((category) =>
            category.questions.some((q) => q.id === id),
          )
        )
          navigate(id);
      }
    };
    openHash();
    window.addEventListener("hashchange", openHash);
    return () => window.removeEventListener("hashchange", openHash);
  }, [locale]);
  useEffect(() => {
    if (!target) return;
    const article = document.getElementById(
      `faq-${target.id}`,
    ) as HTMLDetailsElement | null;
    if (!article) return;
    article.open = true;
    article.scrollIntoView({ block: "start", behavior: "instant" });
    article.querySelector("summary")?.focus({ preventScroll: true });
    window.history.replaceState(null, "", `#faq-${target.id}`);
  }, [target]);
  function relatedFor(question: FAQQuestion) {
    const ids = question.related ?? [
      "device-compatibility",
      "data-roaming",
      "no-internet",
    ];
    return ids
      .filter((id) => id !== question.id)
      .map((id) => allQuestions.find((q) => q.id === id))
      .filter((q): q is FAQQuestion => Boolean(q));
  }
  return (
    <section className="container faq-center faq-explorer">
      <div className="faq-search-panel">
        <div className="directory-search">
          <Search size={22} />
          <label htmlFor="faq-search" className="sr-only">
            {c.search}
          </label>
          <input
            ref={search}
            id="faq-search"
            type="search"
            enterKeyHint="search"
            value={query}
            placeholder={c.search}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
          />
          {query && (
            <button
              type="button"
              className="icon-button"
              aria-label={c.reset}
              onClick={() => {
                setQuery("");
                search.current?.focus();
              }}
            >
              <X size={18} />
            </button>
          )}
        </div>
        <p>
          {locale === "es"
            ? "Por ejemplo: roaming, QR, hotspot o llamadas."
            : "Try roaming, QR, hotspot or calls."}
        </p>
      </div>
      <div className="faq-topic-selector" role="group" aria-label={c.all}>
        {c.categories.map((category) => {
          const Icon =
            helpTopicIcons[category.id as keyof typeof helpTopicIcons];
          return (
            <button
              key={category.id}
              type="button"
              aria-pressed={topic === category.id}
              onClick={() => {
                setTopic(topic === category.id ? "all" : category.id);
                setTarget(null);
              }}
            >
              <span className="learning-icon">
                <Icon size={23} />
              </span>
              <span className="faq-topic-text">
                <strong>{category.title}</strong>
                <small>
                  {category.questions.length} {c.questions}
                </small>
              </span>
              {topic === category.id ? (
                <Check size={17} />
              ) : (
                <ArrowRight size={17} />
              )}
            </button>
          );
        })}
      </div>
      <div className="faq-results-bar">
        <p className="directory-count" role="status">
          {categories.reduce(
            (sum, category) => sum + category.questions.length,
            0,
          )}{" "}
          {c.questions}
          {topic !== "all" &&
            ` · ${c.categories.find((category) => category.id === topic)?.title}`}
        </p>
        <button
          type="button"
          aria-pressed={topic === "all" && !query}
          onClick={() => {
            setQuery("");
            setTopic("all");
            setTarget(null);
          }}
        >
          {c.all}
        </button>
      </div>
      {categories.map((category) => {
        const Icon = helpTopicIcons[category.id as keyof typeof helpTopicIcons];
        return (
          <section
            className="faq-section faq-category"
            key={category.id}
            id={category.id}
          >
            <div className="faq-intro">
              <span className="learning-icon">
                <Icon size={24} />
              </span>
              <h2>{category.title}</h2>
              <p>{category.description}</p>
            </div>
            <div className="faq-list">
              {category.questions.map((question) => (
                <details key={question.id} id={`faq-${question.id}`}>
                  <summary>
                    {question.question}
                    <span className="faq-expand">
                      <Plus size={17} />
                    </span>
                  </summary>
                  <div className="faq-answer faq-rich-answer">
                    <p>{question.answer}</p>
                    {question.steps && (
                      <ol className="faq-steps">
                        {question.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    )}
                    {question.note && (
                      <div className="faq-answer-note">
                        <Info size={18} />
                        <p>{question.note}</p>
                      </div>
                    )}
                    {question.links && (
                      <div className="faq-guide-links">
                        {question.links.map((link) => (
                          <a key={link.href} href={link.href}>
                            {link.label}
                            <ArrowRight size={16} />
                          </a>
                        ))}
                      </div>
                    )}
                    <FAQFeedback
                      locale={locale}
                      question={question}
                      related={relatedFor(question)}
                      onNavigate={navigate}
                    />
                  </div>
                </details>
              ))}
            </div>
          </section>
        );
      })}
      {!categories.length && (
        <div className="empty-state">
          <Search size={28} />
          <p>{c.empty}</p>
          <button
            className="button button-secondary"
            onClick={() => {
              setQuery("");
              setTopic("all");
            }}
          >
            {c.reset}
          </button>
        </div>
      )}
      <aside className="faq-sources">
        <h2>{c.sources}</h2>
        <p>{c.sourceDescription}</p>
        <a href="https://support.apple.com/en-us/118669">Apple · eSIM</a>
        <a href="https://support.google.com/pixelphone/answer/9449293">
          Google Pixel · eSIM
        </a>
      </aside>
    </section>
  );
}
