import Link from "next/link";
import { ArrowRight, CalendarDays, Globe2, Info, Wifi } from "lucide-react";
import { pathFor, type Locale } from "@/lib/i18n";
import type { Destination } from "@/lib/catalog";
import type { Plan } from "@/lib/plan-utils";
import { experienceCopy } from "@/lib/experience-copy";
import { experiencePath } from "@/lib/experience-routes";
import { CompatibilityChecker } from "@/components/compatibility-checker";
import { DestinationFlag } from "@/components/destination-flag";
import { PlanNetworkDetails } from "./plan-network-details";

export function PlanInformation({
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
      className="plan-information"
      aria-label={es ? "Ficha completa del plan" : "Full plan details"}
    >
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
      <section className="selected-plan-section">
        <h3>
          <Globe2 size={18} />
          {c.coverage}
        </h3>
        <p>{destination.name[locale]}</p>
        {destination.type === "region" && !details && (
          <p className="selected-plan-note">{c.regionalCoverage}</p>
        )}
        <dl className="selected-plan-facts">
          <div>
            <dt>{es ? "Tecnología del plan" : "Plan technology"}</dt>
            <dd className={!details ? "is-pending" : undefined}>
              {details ? details.technologies.join(" / ") : c.pending}
            </dd>
          </div>
          <div>
            <dt>{c.activation}</dt>
            <dd className={!details ? "is-pending" : undefined}>
              {activation}
            </dd>
          </div>
        </dl>
        {details && (
          <PlanNetworkDetails
            locale={locale}
            details={details}
            regional={destination.type === "region"}
          />
        )}
      </section>
      <section className="selected-plan-section">
        <h3>{c.conditions}</h3>
        <ul className="selected-plan-conditions">
          <li>
            <strong>{es ? "Datos" : "Data"}</strong>
            <span>
              {es
                ? "Bolsa fija de datos para toda la vigencia."
                : "A fixed data allowance for the validity period."}
            </span>
          </li>
          <li>
            <strong>{c.hotspot}</strong>
            <span>{c.hotspotBody}</span>
          </li>
          <li>
            <strong>{c.calls}</strong>
            <span>{c.callsBody}</span>
          </li>
          {details && (
            <li>
              <strong>{es ? "Recarga de datos" : "Data top-up"}</strong>
              <span>
                {details.topUp === "none"
                  ? es
                    ? "Este plan no admite recargas."
                    : "This plan cannot be topped up."
                  : es
                    ? "Permite añadir datos para la misma zona dentro de la vigencia. La recarga aún no está disponible en la web."
                    : "Supports adding data for the same area within the validity period. Top-ups are not available on the website yet."}
              </span>
            </li>
          )}
          {details?.fairUse && (
            <li>
              <strong>{es ? "Uso justo" : "Fair use"}</strong>
              <span>
                {es
                  ? `El proveedor indica ${details.fairUse}. El momento y las condiciones de aplicación están pendientes de confirmar.`
                  : `The provider lists ${details.fairUse}. The trigger and application conditions still need confirmation.`}
              </span>
            </li>
          )}
          <li>
            <strong>{es ? "Instalación" : "Installation"}</strong>
            <span>
              {es
                ? "Equipo compatible, liberado y conexión a internet."
                : "Compatible, carrier-unlocked device and an internet connection."}{" "}
              <Link href={experiencePath(locale, "install")}>
                {es ? "Ver guía" : "See guide"}
                <ArrowRight size={12} />
              </Link>
            </span>
          </li>
        </ul>
      </section>
      {details?.apn && (
        <details className="plan-network-disclosure plan-apn-details">
          <summary>{es ? "Configuración APN" : "APN settings"}</summary>
          <code>{details.apn}</code>
          <p className="selected-plan-note">
            {es
              ? "Solo si las instrucciones de instalación te piden configurar el APN manualmente. No cambies el de tu SIM habitual."
              : "Only if the installation instructions ask you to set the APN manually. Do not change your home SIM's APN."}
          </p>
        </details>
      )}
      <p className="selected-plan-source-name">Plan: {plan.name}</p>
      <p className="selected-plan-notice">
        <Info size={16} />
        {es
          ? "Información del proveedor. Revisa las condiciones y la compatibilidad de tu equipo antes de viajar."
          : "Provider information. Check the conditions and your device's compatibility before travelling."}
      </p>
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
