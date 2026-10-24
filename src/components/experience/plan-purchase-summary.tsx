import Link from "next/link";
import { ArrowRight, CalendarDays, Check, Wifi } from "lucide-react";
import { pathFor, type Locale } from "@/lib/i18n";
import type { Destination } from "@/lib/catalog";
import type { Plan } from "@/lib/plan-utils";
import { experienceCopy } from "@/lib/experience-copy";
import { experiencePath } from "@/lib/experience-routes";
import { CompatibilityChecker } from "@/components/compatibility-checker";
import { DestinationFlag } from "@/components/destination-flag";

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
  return (
    <section className="plan-purchase-summary">
      <header className="selected-plan-heading">
        <p className="eyebrow">
          {es ? "Tu plan seleccionado" : "Your selected plan"}
        </p>
        <div>
          <DestinationFlag destination={destination} />
          <h2>{destination.name[locale]}</h2>
          <span className="selected-plan-tag">{c.fixed}</span>
        </div>
      </header>
      <div
        className="selected-plan-stats"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <div>
          <Wifi size={22} />
          <strong>{plan.allowance}</strong>
        </div>
        <div>
          <CalendarDays size={20} />
          <strong>
            {plan.days} <span>{plan.days === 1 ? c.day : c.days}</span>
          </strong>
        </div>
      </div>
      <CompatibilityChecker locale={locale} />
      <ul className="purchase-highlights">
        <li>
          <Check size={16} aria-hidden="true" />
          {es
            ? "Una bolsa de datos para todo el viaje"
            : "One data allowance for your trip"}
        </li>
        <li>
          <Check size={16} aria-hidden="true" />
          {es
            ? "Instalación digital en un equipo compatible"
            : "Digital installation on a compatible device"}
        </li>
      </ul>
      <footer className="selected-plan-footer">
        <Link
          className="button button-primary"
          href={experiencePath(locale, "checkout", {
            destination: destination.slug,
            plan: plan.id,
          })}
        >
          {c.previewPurchase}
          <ArrowRight size={17} />
        </Link>
        <p>
          {es
            ? "Vista de ejemplo. Aún no se realizan pagos ni activaciones."
            : "Visual preview. Payments and activation are not available yet."}
        </p>
        <Link className="selected-plan-faq" href={pathFor(locale, "faq")}>
          {es ? "¿Tienes dudas? Consulta las FAQ" : "Questions? Visit the FAQ"}
        </Link>
      </footer>
    </section>
  );
}
