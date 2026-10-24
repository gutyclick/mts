"use client";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { helpContent } from "@/lib/help-content";
import { normalize } from "@/lib/text";
import type { Locale } from "@/lib/i18n";
export function FAQCenter({ locale }: { locale: Locale }) {
  const c = helpContent[locale];
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState("all");
  const categories = c.categories
    .filter((category) => topic === "all" || category.id === topic)
    .map((category) => ({
      ...category,
      questions: category.questions.filter(([q, a]) =>
        normalize(`${q} ${a}`).includes(normalize(query)),
      ),
    }))
    .filter((category) => category.questions.length);
  return (
    <section className="container faq-center">
      <div className="directory-search">
        <Search size={21} />
        <label htmlFor="faq-search" className="sr-only">
          {c.search}
        </label>
        <input
          id="faq-search"
          type="search"
          value={query}
          placeholder={c.search}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="catalog-tabs" role="group" aria-label={c.all}>
        {[{ id: "all", title: c.all }, ...c.categories].map(({ id, title }) => (
          <button
            key={id}
            aria-pressed={topic === id}
            onClick={() => setTopic(id)}
          >
            {title}
          </button>
        ))}
      </div>
      <p className="directory-count" role="status">
        {categories.reduce(
          (sum, category) => sum + category.questions.length,
          0,
        )}{" "}
        {c.questions}
      </p>
      {categories.map((category) => (
        <section
          className="faq-section faq-category"
          key={category.id}
          id={category.id}
        >
          <div className="faq-intro">
            <h2>{category.title}</h2>
            <p>{category.description}</p>
          </div>
          <div className="faq-list">
            {category.questions.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <Plus size={18} />
                </summary>
                <div className="faq-answer">
                  <p>{answer}</p>
                </div>
              </details>
            ))}
          </div>
        </section>
      ))}
      {!categories.length && (
        <div className="empty-state">
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
        <a href="https://support.apple.com/en-gb/118227">Apple · eSIM</a>
        <a href="https://support.google.com/pixelphone/answer/9449293">
          Google Pixel · eSIM
        </a>
      </aside>
    </section>
  );
}
