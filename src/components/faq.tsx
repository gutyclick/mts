import { Plus } from "lucide-react";
import { dictionaries, type Locale } from "@/lib/i18n";
export function FAQ({
  locale,
  title,
  compact = false,
}: {
  locale: Locale;
  title?: string;
  compact?: boolean;
}) {
  const t = dictionaries[locale];
  return (
    <section className={`faq-section ${compact ? "faq-compact" : ""}`}>
      <div className="faq-intro">
        <p className="eyebrow">FAQ</p>
        <h2>{title ?? t.faqTitle}</h2>
        <p>{t.faqDescription}</p>
      </div>
      <div className="faq-list">
        {t.faqs.map((faq) => (
          <details key={faq.question}>
            <summary>
              {faq.question}
              <Plus size={19} />
            </summary>
            <div className="faq-answer">
              <p>{faq.answer}</p>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
