import Link from "next/link";
import { FileText, Mail, MapPin, ShieldCheck, List } from "lucide-react";
import { dictionaries, pathFor, type Locale } from "@/lib/i18n";
import {
  legalDate,
  legalDescriptions,
  legalDocument,
  legalIdentity,
  legalKeys,
  legalVersion,
  type LegalBlock,
  type LegalKey,
} from "@/lib/legal";

function LegalText({ text }: { text: string }) {
  return text.split(legalIdentity.email).map((part, index) => (
    <span key={index}>
      {index > 0 && (
        <a href={`mailto:${legalIdentity.email}`}>{legalIdentity.email}</a>
      )}
      {part}
    </span>
  ));
}
function Block({ block }: { block: LegalBlock }) {
  if (block.type === "list")
    return (
      <ul>
        {block.items.map((item, i) => (
          <li key={i}>
            <LegalText text={item} />
          </li>
        ))}
      </ul>
    );
  if (block.type === "table")
    return (
      <div
        className="legal-table-scroll"
        role="region"
        aria-label={block.headers.join(" / ")}
        tabIndex={0}
      >
        <table>
          <thead>
            <tr>
              {block.headers.map((header) => (
                <th scope="col" key={header}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} data-label={block.headers[j]}>
                    <LegalText text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  return (
    <p>
      <LegalText text={block.text} />
    </p>
  );
}
export function LegalPage({
  locale,
  document: key,
}: {
  locale: Locale;
  document: LegalKey;
}) {
  const es = locale === "es",
    document = legalDocument(locale, key);
  return (
    <div className="legal-page container">
      <header className="legal-heading">
        <span className="legal-heading-icon">
          <ShieldCheck size={26} />
        </span>
        <p className="eyebrow">
          MYTRIPSIM / {es ? "INFORMACIÓN LEGAL" : "LEGAL INFORMATION"}
        </p>
        <h1>{document.title}</h1>
        <p>{legalDescriptions[locale][key]}</p>
        <div className="legal-version">
          <FileText size={15} />
          {es ? "Vigente desde" : "Effective from"}{" "}
          <time dateTime={legalDate}>
            {es ? "26 de octubre de 2026" : "October 26, 2026"}
          </time>
          <span>· {legalVersion}</span>
        </div>
      </header>
      <nav
        className="legal-navigation"
        aria-label={es ? "Documentos legales" : "Legal documents"}
      >
        {legalKeys.map((item) => (
          <Link
            key={item}
            href={pathFor(locale, item)}
            aria-current={key === item ? "page" : undefined}
          >
            {dictionaries[locale].nav[item]}
          </Link>
        ))}
      </nav>
      <div className="legal-layout">
        <aside className="legal-sidebar">
          <details className="legal-index" open>
            <summary>
              <List size={18} />
              {es ? "En este documento" : "In this document"}
            </summary>
            <ol>
              {document.sections.map((section) => (
                <li key={section.id}>
                  <a href={`#${section.id}`}>
                    {section.title.replace(/^\d+\.\s*/, "")}
                  </a>
                </li>
              ))}
            </ol>
          </details>
          <div className="legal-contact-card">
            <strong>{es ? "¿Necesitas ayuda?" : "Need help?"}</strong>
            <a href={`mailto:${legalIdentity.email}`}>
              <Mail size={16} />
              {legalIdentity.email}
            </a>
          </div>
        </aside>
        <article className="legal-document" aria-label={document.title}>
          <div className="legal-seller">
            <strong>{legalIdentity.name}</strong>
            <p>
              <MapPin size={16} />
              {legalIdentity.address}
            </p>
            <a href={`mailto:${legalIdentity.email}`}>
              <Mail size={16} />
              {legalIdentity.email}
            </a>
          </div>
          {document.sections.map((section) => (
            <section id={section.id} key={section.id}>
              <h2>{section.title}</h2>
              {section.blocks.map((block, index) => (
                <Block key={index} block={block} />
              ))}
            </section>
          ))}
          {key === "privacy" && (
            <section className="legal-provider-links">
              <h2>
                {es
                  ? "Información de nuestros proveedores"
                  : "Provider information"}
              </h2>
              <p>
                {es
                  ? "Consulta sus avisos y documentación. MyTripSim sigue siendo tu contacto para las operaciones descritas en esta política."
                  : "Read their notices and documentation. MyTripSim remains your contact for the operations described in this policy."}
              </p>
              <ul>
                {[
                  ["Stripe", "https://stripe.com/privacy"],
                  ["Supabase", "https://supabase.com/privacy"],
                  ["Vercel", "https://vercel.com/legal/privacy-notice"],
                  ["Resend", "https://resend.com/legal/privacy-policy"],
                  ["eSIM Access", "https://esimaccess.com/privacy-policy/"],
                  ["Zoho", "https://www.zoho.com/privacy.html"],
                  [
                    "OpenAI API",
                    "https://developers.openai.com/api/docs/guides/your-data",
                  ],
                ].map(([name, url]) => (
                  <li key={name}>
                    <a href={url}>{name}</a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="legal-document-end">
            <p>
              {es
                ? "Conserva una copia de estas condiciones y del resumen de tu pedido. Si tienes dudas sobre su contenido, escríbenos."
                : "Keep a copy of these documents and your order summary. Contact us if you have questions about their content."}
            </p>
            <a href={`mailto:${legalIdentity.email}`}>{legalIdentity.email}</a>
          </div>
        </article>
      </div>
    </div>
  );
}
