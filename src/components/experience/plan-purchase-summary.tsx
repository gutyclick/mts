import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  Gauge,
  RadioTower,
  Settings2,
  Wifi,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { Destination } from "@/lib/catalog";
import type { Plan } from "@/lib/plan-utils";
import { experienceCopy } from "@/lib/experience-copy";
import { experiencePath } from "@/lib/experience-routes";
import { CompatibilityChecker } from "@/components/compatibility-checker";
import { PlanInformation } from "./plan-information";
import { PlanNetworkDetails } from "./plan-network-details";

export function PlanPurchaseSummary({
  locale,
  destination,
  plan,
}: {
  locale: Locale;
  destination: Destination;
  plan: Plan;
}) {
  const c = experienceCopy[locale];
  const es = locale === "es";
  const details = plan.details;
  const operators = [
    ...new Set(
      details?.networks.flatMap((group) =>
        group.operators.map((operator) => operator.name),
      ) ?? [],
    ),
  ];
  const activation = details
    ? (es
        ? {
            network: "Al conectarse por primera vez a la red",
            installation: "Al instalar la eSIM",
            purchase: "Después de la compra",
          }
        : {
            network: "On the first network connection",
            installation: "When the eSIM is installed",
            purchase: "After purchase",
          })[details.activation]
    : c.pending;
  return (
    <section
      className="plan-purchase-summary"
      aria-label={
        es ? "Resumen del plan seleccionado" : "Selected plan summary"
      }
    >
      <header className="selected-plan-heading">
        <h2>{es ? "Tu selección" : "Your selection"}</h2>
        <span className="selected-plan-tag">{c.fixed}</span>
      </header>
      <div
        className="selected-plan-stats"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div>
          <Wifi size={21} aria-hidden="true" />
          <strong>{plan.allowance}</strong>
        </div>
        <div>
          <CalendarDays size={20} aria-hidden="true" />
          <strong>
            {plan.days} <span>{plan.days === 1 ? c.day : c.days}</span>
          </strong>
        </div>
      </div>
      <dl className="plan-essential-facts">
        <div>
          <dt>
            <RadioTower size={16} aria-hidden="true" />
            {es ? "Red" : "Network"}
          </dt>
          <dd>{details?.technologies.join(" / ") || c.pending}</dd>
        </div>
        <div>
          <dt>
            <Wifi size={16} aria-hidden="true" />
            {destination.type === "region"
              ? c.coverage
              : es
                ? "Operadores"
                : "Operators"}
          </dt>
          <dd>
            {destination.type === "region"
              ? details
                ? `${details.coverage.length} ${es ? "países y territorios" : "countries and territories"}`
                : c.pending
              : operators.join(", ") || c.pending}
          </dd>
        </div>
        <div>
          <dt>
            <Clock3 size={16} aria-hidden="true" />
            {es ? "Inicio de vigencia" : "Validity starts"}
          </dt>
          <dd>{activation}</dd>
        </div>
      </dl>
      {details && (
        <PlanNetworkDetails
          locale={locale}
          details={details}
          regional={destination.type === "region"}
          view="summary"
        />
      )}
      {details?.fairUse && (
        <p className="plan-fair-use">
          <Gauge size={17} aria-hidden="true" />
          {es
            ? `El proveedor indica ${details.fairUse}. Las condiciones de aplicación están pendientes de confirmar.`
            : `The provider lists ${details.fairUse}. The conditions for applying it still need confirmation.`}
        </p>
      )}
      <CompatibilityChecker locale={locale} />
      <footer className="selected-plan-footer">
        <Link
          className="button button-primary"
          href={experiencePath(locale, "checkout", {
            destination: destination.slug,
            plan: plan.id,
          })}
        >
          {c.previewPurchase}
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
        <p>
          {es
            ? "Compra de ejemplo. Aún no se realizan pagos ni activaciones."
            : "Purchase preview. Payments and activation are not available yet."}
        </p>
      </footer>
      <details className="plan-technical-details">
        <summary>
          <Settings2 size={16} aria-hidden="true" />
          {es
            ? "Detalles técnicos y condiciones"
            : "Technical details and conditions"}
        </summary>
        <PlanInformation
          locale={locale}
          destination={destination}
          plan={plan}
        />
      </details>
    </section>
  );
}
