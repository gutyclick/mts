"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Info, Plus, Search, X } from "lucide-react";
import { helpContent, type FAQQuestion } from "@/lib/help-content";
import { normalize } from "@/lib/text";
import { faqTopicPath, pathFor, type Locale } from "@/lib/i18n";
import { isFAQTopic, type FAQTopic } from "@/lib/faq-topics";
import { faqQuestionPath } from "@/lib/faq-links";
import { FAQFeedback } from "./faq-feedback";
import { helpTopicIcons } from "./help-topic-icons";

export function FAQCenter({
  locale,
  topicId,
}: {
  locale: Locale;
  topicId?: FAQTopic;
}) {
  const c = helpContent[locale];
  const [query, setQuery] = useState("");
  const [target, setTarget] = useState<{ id: string } | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const topicNavigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const nav = topicNavigation.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && active && nav.scrollWidth > nav.clientWidth) {
      nav.scrollLeft +=
        active.getBoundingClientRect().left -
        nav.getBoundingClientRect().left -
        (nav.clientWidth - active.clientWidth) / 2;
    }
  }, [topicId]);
  const allQuestions = c.categories.flatMap((category) => category.questions);
  const categories = c.categories
    .filter((category) => !topicId || category.id === topicId)
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
  useEffect(() => {
    const openHash = () => {
      const hash = window.location.hash.slice(1);
      const category = c.categories.find(
        (category) =>
          hash === category.id ||
          category.questions.some((q) => hash === `faq-${q.id}`),
      );
      if (!category || !isFAQTopic(category.id)) return;
      if (category.id !== topicId) {
        window.location.replace(
          hash.startsWith("faq-")
            ? faqQuestionPath(locale, hash.slice(4))
            : faqTopicPath(locale, category.id),
        );
      } else if (hash.startsWith("faq-")) {
        setQuery("");
        setTarget({ id: hash.slice(4) });
      }
    };
    openHash();
    window.addEventListener("hashchange", openHash);
    return () => window.removeEventListener("hashchange", openHash);
  }, [locale, topicId, c.categories]);
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
          {topicId
            ? locale === "es"
              ? "Busca dentro de este tema. Puedes volver a Todos los temas para otra consulta."
              : "Search within this topic. Return to All topics for a different question."
            : locale === "es"
              ? "Por ejemplo: roaming, QR, hotspot o llamadas."
              : "Try roaming, QR, hotspot or calls."}
        </p>
      </div>
      {!topicId && (
        <nav className="faq-topic-selector" aria-label={c.all}>
          {c.categories.map((category) => {
            const Icon =
              helpTopicIcons[category.id as keyof typeof helpTopicIcons];
            return (
              <Link
                key={category.id}
                href={faqTopicPath(locale, category.id as FAQTopic)}
              >
                <span className="learning-icon">
                  <Icon size={23} aria-hidden="true" />
                </span>
                <span className="faq-topic-text">
                  <strong>{category.title}</strong>
                  <span>{category.description}</span>
                  <small>
                    {category.questions.length} {c.questions}
                  </small>
                </span>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            );
          })}
        </nav>
      )}
      {(topicId || query) && (
        <div className="faq-results-bar">
          <p className="directory-count" role="status">
            {categories.reduce(
              (sum, category) => sum + category.questions.length,
              0,
            )}{" "}
            {c.questions}
          </p>
          <Link href={pathFor(locale, "faq")} onClick={() => setQuery("")}>
            <ArrowLeft size={14} aria-hidden="true" />
            {c.all}
          </Link>
        </div>
      )}
      {!topicId && query && (
        <div className="faq-search-results">
          {categories.map((category) => (
            <section key={category.id}>
              <h2>{category.title}</h2>
              {category.questions.map((question) => (
                <Link
                  href={faqQuestionPath(locale, question.id)}
                  key={question.id}
                >
                  {question.question}
                  <ArrowRight size={17} aria-hidden="true" />
                </Link>
              ))}
            </section>
          ))}
        </div>
      )}
      {topicId && (
        <div className="faq-topic-layout">
          <nav
            ref={topicNavigation}
            className="faq-topic-navigation"
            aria-label={c.all}
          >
            <p>{locale === "es" ? "Explora los temas" : "Explore topics"}</p>
            {c.categories.map((category) => {
              const Icon =
                helpTopicIcons[category.id as keyof typeof helpTopicIcons];
              return (
                <Link
                  key={category.id}
                  href={faqTopicPath(locale, category.id as FAQTopic)}
                  aria-current={category.id === topicId ? "page" : undefined}
                >
                  <Icon size={18} aria-hidden="true" />
                  {category.title}
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              );
            })}
          </nav>
          <div>
            {categories.map((category) => {
              return (
                <section
                  className="faq-category faq-topic-answers"
                  key={category.id}
                  id={category.id}
                >
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
                          />
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
      {(topicId || query) && !categories.length && (
        <div className="empty-state">
          <Search size={28} />
          <p>{c.empty}</p>
          <button
            className="button button-secondary"
            onClick={() => {
              setQuery("");
            }}
          >
            {c.reset}
          </button>
        </div>
      )}
      {topicId && (
        <aside className="faq-sources">
          <h2>{c.sources}</h2>
          <p>{c.sourceDescription}</p>
          <a href="https://support.apple.com/en-us/118669">Apple · eSIM</a>
          <a href="https://support.google.com/pixelphone/answer/9449293">
            Google Pixel · eSIM
          </a>
        </aside>
      )}
    </section>
  );
}
