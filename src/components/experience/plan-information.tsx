import { RadioTower, RefreshCw, Settings2 } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { Destination } from "@/lib/catalog";
import type { Plan } from "@/lib/plan-utils";
import { PlanNetworkDetails } from "./plan-network-details";

/** Secondary, variant-specific details. General eSIM guidance lives below the purchase panel. */
export function PlanInformation({
  locale,
  destination,
  plan,
}: {
  locale: Locale;
  destination: Destination;
  plan: Plan;
}) {
  const es = locale === "es";
  const details = plan.details;
  return (
    <div className="plan-information">
      {details ? (
        <>
          <h3>
            <RadioTower size={17} aria-hidden="true" />
            {es ? "Redes del proveedor" : "Provider networks"}
          </h3>
          <PlanNetworkDetails
            locale={locale}
            details={details}
            regional={destination.type === "region"}
            view="technical"
          />
          <h3>
            <RefreshCw size={17} aria-hidden="true" />
            {es ? "Recarga de datos" : "Data top-up"}
          </h3>
          <p>
            {details.topUp === "none"
              ? es
                ? "Este plan no admite recargas."
                : "This plan cannot be topped up."
              : es
                ? "Este plan admite datos adicionales para la misma zona dentro de su vigencia. Consulta con soporte las opciones para tu eSIM."
                : "Supports additional data for the same area within its validity period. Contact support to check options for your eSIM."}
          </p>
          {details.apn && (
            <div className="plan-apn-details">
              <h3>
                <Settings2 size={17} aria-hidden="true" />
                {es ? "Configuración APN" : "APN settings"}
              </h3>
              <code>{details.apn}</code>
              <p className="selected-plan-note">
                {es
                  ? "Configúralo solo si las instrucciones del plan lo solicitan. No cambies el APN de tu SIM habitual."
                  : "Set this only if your plan's instructions request it. Do not change your home SIM's APN."}
              </p>
            </div>
          )}
        </>
      ) : (
        <p>
          {es
            ? "Los detalles técnicos de este plan están pendientes de confirmar."
            : "Technical details for this plan still need confirmation."}
        </p>
      )}
      <p className="selected-plan-source-name">Plan: {plan.name}</p>
    </div>
  );
}
