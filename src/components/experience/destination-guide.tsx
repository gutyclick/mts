import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CircleHelp,
  Phone,
  Database,
  Globe2,
  ListChecks,
  Smartphone,
  Wifi,
} from "lucide-react";
import type { Destination } from "@/lib/catalog";
import type { Plan } from "@/lib/plan-utils";
import { faqTopicPath, pathFor, type Locale } from "@/lib/i18n";
import { destinationContent } from "@/lib/destination-content";
import { relatedCoverageDestinations } from "@/lib/destination-links";
import { getDestinations } from "@/lib/catalog-server";
import { experienceCopy } from "@/lib/experience-copy";
import { experiencePath } from "@/lib/experience-routes";

export async function DestinationGuide({
  locale,
  destination,
  plans,
}: {
  locale: Locale;
  destination: Destination;
  plans: Plan[];
}) {
  const es = locale === "es";
  const c = experienceCopy[locale];
  const content = destinationContent(locale, destination, plans);
  const related = relatedCoverageDestinations(
    destination,
    plans,
    await getDestinations(),
    locale,
  );
  return (
    <div className="destination-guide">
      <section
        className="destination-overview"
        aria-labelledby="destination-guide-title"
      >
        <div>
          <p className="eyebrow">
            {es ? "Prepara tu conexión" : "Prepare your connection"}
          </p>
          <h2 id="destination-guide-title">
            <Globe2 aria-hidden="true" />
            {es
              ? `Tu eSIM para ${content.name}`
              : `Your eSIM for ${content.name}`}
          </h2>
          <p>{content.selectionSummary}</p>
          <div className="destination-editorial-facts">
            <div>
              <h3>
                {es ? "Cobertura y operadores" : "Coverage and operators"}
              </h3>
              <p>{content.networkSummary}</p>
            </div>
            <div>
              <h3>
                {es ? "Cuándo comienza tu plan" : "When your plan starts"}
              </h3>
              <p>{content.activation}</p>
            </div>
          </div>
        </div>
        <ul className="destination-benefits">
          <li>
            <Database size={22} aria-hidden="true" />
            <h3>{es ? "Datos fijos" : "Fixed data"}</h3>
            <p>
              {es
                ? "Una bolsa de datos para toda la vigencia del plan, sin paquetes diarios."
                : "One data allowance for the full validity period, with no daily packages."}
            </p>
            <Link href={pathFor(locale, "compatibility")}>
              {es
                ? "Verificar compatibilidad eSIM"
                : "Check eSIM compatibility"}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </li>
          <li>
            <Wifi size={22} aria-hidden="true" />
            <h3>{c.hotspot}</h3>
            <p>{c.hotspotBody}</p>
          </li>
          <li>
            <Phone size={22} aria-hidden="true" />
            <h3>{c.calls}</h3>
            <p>{c.callsBody}</p>
          </li>
        </ul>
      </section>
      <section
        className="destination-steps"
        aria-labelledby="destination-steps-title"
      >
        <h2 id="destination-steps-title">
          <BookOpen aria-hidden="true" />
          {es ? "Todo listo, paso a paso" : "Get ready, step by step"}
        </h2>
        <ol>
          <li>
            <span>01</span>
            <Smartphone aria-hidden="true" />
            <h3>{es ? "Comprueba tu equipo" : "Check your device"}</h3>
            <p>
              {es
                ? "Modelo compatible con eSIM, variante regional admitida y equipo liberado."
                : "An eSIM-compatible model, supported regional variant and carrier-unlocked device."}
            </p>
            <Link href={faqTopicPath(locale, "data")}>
              {es ? "Entender los planes de datos" : "Understand data plans"}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </li>
          <li>
            <span>02</span>
            <ListChecks aria-hidden="true" />
            <h3>{es ? "Elige tus GB y días" : "Choose data and days"}</h3>
            <p>
              {es
                ? "Revisa la cobertura y el inicio de la vigencia del plan antes de instalar."
                : "Review your plan's coverage and validity start before installing."}
            </p>
          </li>
          <li>
            <span>03</span>
            <Wifi aria-hidden="true" />
            <h3>
              {es
                ? "Sigue la guía de instalación"
                : "Follow the installation guide"}
            </h3>
            <p>
              {es
                ? "Necesitarás conexión a internet. Configura la línea de datos y la itinerancia según las instrucciones."
                : "You will need an internet connection. Set up your data line and roaming as instructed."}
            </p>
            <Link href={experiencePath(locale, "install")}>
              {es ? "Ver la guía" : "See the guide"}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </li>
        </ol>
      </section>
      <section
        className="destination-faq"
        aria-labelledby="destination-faq-title"
      >
        <p className="eyebrow">
          {es ? "Viaja con las cosas claras" : "Know before you go"}
        </p>
        <h2 id="destination-faq-title">
          <CircleHelp aria-hidden="true" />
          {es
            ? `Preguntas sobre tu eSIM para ${content.name}`
            : `Questions about your ${content.name} eSIM`}
        </h2>
        <div>
          {content.faqs.map((faq) => (
            <details key={faq.question}>
              <summary>{faq.question}</summary>
              <p>{faq.answer}</p>
            </details>
          ))}
        </div>
        <Link className="destination-faq-link" href={pathFor(locale, "faq")}>
          {es
            ? "Explorar el centro de preguntas frecuentes"
            : "Explore all frequently asked questions"}
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </section>
      {related.length > 0 && (
        <section
          className="destination-related"
          aria-labelledby="destination-related-title"
        >
          <h2 id="destination-related-title">
            <Globe2 aria-hidden="true" />
            {es ? "¿Viajas a un solo país?" : "Traveling to one country?"}
          </h2>
          <p>
            {es
              ? "Estos países aparecen en la cobertura de una o más variantes de este destino. También puedes consultar sus planes individuales; comprueba siempre la cobertura del plan que elijas."
              : "These countries appear in the coverage of one or more variants for this destination. You can also compare their individual plans; always check the coverage of your chosen plan."}
          </p>
          <ul>
            {related.map((country) => (
              <li key={country.slug}>
                <Link href={pathFor(locale, undefined, country.slug)}>
                  {es
                    ? `eSIM para ${country.name[locale]}`
                    : `${country.name[locale]} eSIM`}
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <Link
            className="destination-faq-link"
            href={pathFor(locale, "destinations")}
          >
            {es
              ? "Explorar todos los destinos eSIM"
              : "Explore all eSIM destinations"}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
      )}
    </div>
  );
}
