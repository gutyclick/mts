import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CircleHelp,
  Database,
  Globe2,
  ListChecks,
  Smartphone,
  Wifi,
} from "lucide-react";
import type { Destination } from "@/lib/catalog";
import type { Plan } from "@/lib/plan-utils";
import { pathFor, type Locale } from "@/lib/i18n";
import { destinationContent } from "@/lib/destination-content";
import { experiencePath } from "@/lib/experience-routes";

export function DestinationGuide({
  locale,
  destination,
  plans,
}: {
  locale: Locale;
  destination: Destination;
  plans: Plan[];
}) {
  const es = locale === "es";
  const content = destinationContent(locale, destination, plans);
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
          <p>
            {es
              ? `Encuentra una bolsa de datos para tu viaje a ${content.name}. Compara las combinaciones del catálogo y revisa las redes y condiciones de la variante que elijas.`
              : `Find a data allowance for your trip to ${content.name}. Compare the catalog's combinations and check the networks and conditions of your chosen variant.`}
          </p>
        </div>
        <dl className="destination-overview-facts">
          <div>
            <dt>
              <Database aria-hidden="true" size={19} />
              {es ? "Datos disponibles" : "Available data"}
            </dt>
            <dd>{content.range}</dd>
          </div>
          <div>
            <dt>
              <CalendarDays aria-hidden="true" size={19} />
              {es ? "Duraciones" : "Durations"}
            </dt>
            <dd>
              {content.duration} {es ? "días" : "days"}
            </dd>
          </div>
          <div>
            <dt>
              <ListChecks aria-hidden="true" size={19} />
              {es ? "Planes fijos" : "Fixed plans"}
            </dt>
            <dd>{plans.length}</dd>
          </div>
        </dl>
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
    </div>
  );
}
