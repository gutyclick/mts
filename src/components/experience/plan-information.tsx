import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Globe2,
  Info,
  Wifi,
  ShieldCheck,
  Database,
  RadioTower,
  Phone,
  RefreshCw,
  Smartphone,
  Gauge,
  Settings2,
} from "lucide-react";
import { type Locale } from "@/lib/i18n";
import type { Destination } from "@/lib/catalog";
import type { Plan } from "@/lib/plan-utils";
import { experienceCopy } from "@/lib/experience-copy";
import { experiencePath } from "@/lib/experience-routes";
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
    <section className="plan-information">
      <header className="plan-detail-title">
        <Info size={23} aria-hidden="true" />
        <h2>{es ? "Tu plan, al detalle" : "Your plan, in detail"}</h2>
        <span>
          {plan.allowance} · {plan.days} {c.days}
        </span>
      </header>
      <div className="plan-detail-grid">
        {" "}
        <section className="selected-plan-section">
          <h3>
            <Globe2 size={20} aria-hidden="true" />
            {c.coverage}
          </h3>
          <p>{destination.name[locale]}</p>
          {destination.type === "region" && !details && (
            <p className="selected-plan-note">{c.regionalCoverage}</p>
          )}
          <dl className="selected-plan-facts">
            <div>
              <dt>
                <RadioTower size={16} aria-hidden="true" />
                {es ? "Tecnología del plan" : "Plan technology"}
              </dt>
              <dd className={!details ? "is-pending" : undefined}>
                {details ? details.technologies.join(" / ") : c.pending}
              </dd>
            </div>
            <div>
              <dt>
                <CalendarDays size={16} aria-hidden="true" />
                {c.activation}
              </dt>
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
          <h3>
            <ShieldCheck size={20} aria-hidden="true" />
            {c.conditions}
          </h3>
          <ul className="selected-plan-conditions">
            <li>
              <strong>
                <Database size={17} aria-hidden="true" />
                {es ? "Datos" : "Data"}
              </strong>
              <span>
                {es
                  ? "Bolsa fija de datos para toda la vigencia."
                  : "A fixed data allowance for the validity period."}
              </span>
            </li>
            <li>
              <strong>
                <Wifi size={17} aria-hidden="true" />
                {c.hotspot}
              </strong>
              <span>{c.hotspotBody}</span>
            </li>
            <li>
              <strong>
                <Phone size={17} aria-hidden="true" />
                {c.calls}
              </strong>
              <span>{c.callsBody}</span>
            </li>
            {details && (
              <li>
                <strong>
                  <RefreshCw size={17} aria-hidden="true" />
                  {es ? "Recarga de datos" : "Data top-up"}
                </strong>
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
                <strong>
                  <Gauge size={17} aria-hidden="true" />
                  {es ? "Uso justo" : "Fair use"}
                </strong>
                <span>
                  {es
                    ? `El proveedor indica ${details.fairUse}. El momento y las condiciones de aplicación están pendientes de confirmar.`
                    : `The provider lists ${details.fairUse}. The trigger and application conditions still need confirmation.`}
                </span>
              </li>
            )}
            <li>
              <strong>
                <Smartphone size={17} aria-hidden="true" />
                {es ? "Instalación" : "Installation"}
              </strong>
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
          {details?.apn && (
            <details className="plan-network-disclosure plan-apn-details">
              <summary>
                <Settings2 size={16} aria-hidden="true" />
                {es ? "Configuración APN" : "APN settings"}
              </summary>
              <code>{details.apn}</code>
              <p className="selected-plan-note">
                {es
                  ? "Solo si las instrucciones de instalación te piden configurar el APN manualmente. No cambies el de tu SIM habitual."
                  : "Only if the installation instructions ask you to set the APN manually. Do not change your home SIM's APN."}
              </p>
            </details>
          )}
        </section>
      </div>
      <p className="selected-plan-source-name">Plan: {plan.name}</p>
      <p className="selected-plan-notice">
        <Info size={16} />
        {es
          ? "Información del proveedor. Revisa las condiciones y la compatibilidad de tu equipo antes de viajar."
          : "Provider information. Check the conditions and your device's compatibility before travelling."}
      </p>
    </section>
  );
}
