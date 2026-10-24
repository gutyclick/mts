"use client";

import { useId, useState } from "react";
import {
  CalendarDays,
  Globe2,
  Info,
  Radio,
  Smartphone,
  Wifi,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { Destination } from "@/lib/catalog";
import type { Plan } from "@/lib/plan-utils";
import { experienceCopy } from "@/lib/experience-copy";
import { CompatibilityChecker } from "@/components/compatibility-checker";
import { DestinationFlag } from "@/components/destination-flag";

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
  const id = useId();
  const [tab, setTab] = useState(0);
  const tabs = es
    ? ["Detalles de eSIM", "Cobertura"]
    : ["eSIM details", "Coverage"];
  const features = [
    {
      icon: Wifi,
      title: `${plan.allowance} ${es ? "para tu viaje" : "for your trip"}`,
      body: es
        ? "Una bolsa de datos fija para usar durante la vigencia del plan."
        : "A fixed data allowance to use during the plan's validity.",
    },
    {
      icon: CalendarDays,
      title: `${plan.days} ${es ? (plan.days === 1 ? "día de duración" : "días de duración") : plan.days === 1 ? "day of validity" : "days of validity"}`,
      body: es
        ? "La regla que inicia la vigencia está pendiente de confirmación."
        : "The rule that starts the validity period is awaiting confirmation.",
    },
    {
      icon: Smartphone,
      title: es ? "Tu conexión, en una eSIM" : "Your connection, on an eSIM",
      body: es
        ? "Necesitas un equipo compatible y liberado por su operador."
        : "You need a compatible, carrier-unlocked device.",
    },
    { icon: Radio, title: c.hotspot, body: c.hotspotBody },
  ];
  return (
    <section
      className="plan-information experience-card"
      aria-label={es ? "Información de la eSIM" : "eSIM information"}
    >
      <div className="plan-information-top">
        <div
          className="plan-info-tabs"
          role="tablist"
          aria-label={es ? "Información del plan" : "Plan information"}
        >
          {tabs.map((label, index) => (
            <button
              key={label}
              role="tab"
              id={`${id}-tab-${index}`}
              aria-selected={tab === index}
              aria-controls={`${id}-panel-${index}`}
              tabIndex={tab === index ? 0 : -1}
              onClick={() => setTab(index)}
              onKeyDown={(event) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 1
                        : 1 - tab;
                  setTab(next);
                  document.getElementById(`${id}-tab-${next}`)?.focus();
                }
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <CompatibilityChecker locale={locale} />
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-0`}
        aria-labelledby={`${id}-tab-0`}
        hidden={tab !== 0}
        tabIndex={0}
      >
        <ul className="plan-info-features">
          {features.map(({ icon: Icon, title, body }) => (
            <li key={title}>
              <span>
                <Icon size={22} />
              </span>
              <div>
                <h2>{title}</h2>
                <p>{body}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div
        role="tabpanel"
        id={`${id}-panel-1`}
        aria-labelledby={`${id}-tab-1`}
        hidden={tab !== 1}
        tabIndex={0}
      >
        <div className="plan-coverage-heading">
          <DestinationFlag destination={destination} />
          <div>
            <h2>{destination.name[locale]}</h2>
            <p>
              {destination.type === "region"
                ? c.regionalCoverage
                : c.countryCoverage}
            </p>
          </div>
        </div>
        <dl className="experience-facts">
          <div>
            <dt>{c.networks}</dt>
            <dd>{c.pending}</dd>
          </div>
          <div>
            <dt>{c.activation}</dt>
            <dd>{c.pending}</dd>
          </div>
        </dl>
        {destination.type === "region" && (
          <p className="plan-info-note">
            <Globe2 size={18} />
            {es
              ? "No mostramos una lista de países hasta confirmar la cobertura exacta con el proveedor."
              : "A country list will be available once the provider confirms the exact coverage."}
          </p>
        )}
      </div>
      <div className="plan-info-note">
        <Info size={18} />
        <p>
          {es
            ? "Todo claro antes de viajar. Las condiciones pendientes se identificarán en esta ficha antes de habilitar la compra."
            : "Know before you go. Pending conditions will be identified here before purchasing is enabled."}
        </p>
      </div>
    </section>
  );
}
