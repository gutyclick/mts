import Image from "next/image";
import type { Locale } from "@/lib/i18n";
import type { PlanDetails } from "@/lib/plan-utils";

export function PlanNetworkDetails({
  locale,
  details,
  regional,
}: {
  locale: Locale;
  details: PlanDetails;
  regional: boolean;
}) {
  const es = locale === "es";
  const display = new Intl.DisplayNames([locale], { type: "region" });
  const technologyDifference = details.networks.some((group) =>
    group.operators.some((operator) =>
      operator.technologies.some((t) => !details.technologies.includes(t)),
    ),
  );
  const countryName = (code: string) =>
    code === "AN"
      ? es
        ? "Antillas Neerlandesas (AN): por confirmar"
        : "Netherlands Antilles (AN): needs confirmation"
      : (display.of(code) ?? code);
  const operators = (group: PlanDetails["networks"][number]) => (
    <ul className="plan-operator-list">
      {group.operators.map((operator, index) => (
        <li key={`${operator.name}-${index}`}>
          <span>{operator.name}</span>
          {operator.technologies.length > 0 && (
            <small>{operator.technologies.join(" / ")}</small>
          )}
        </li>
      ))}
    </ul>
  );
  return (
    <>
      {regional && (
        <details className="plan-network-disclosure">
          <summary>
            {es
              ? "Países y territorios incluidos"
              : "Included countries and territories"}
            <span>{details.coverage.length}</span>
          </summary>
          <ul
            className="plan-coverage-list"
            tabIndex={0}
            aria-label={es ? "Países incluidos" : "Included countries"}
          >
            {details.coverage.map((code) => (
              <li key={code}>
                <Image
                  src={`/flags/${code.toLowerCase()}.svg`}
                  alt=""
                  width={22}
                  height={22}
                />
                <span>{countryName(code)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {regional ? (
        <details className="plan-network-disclosure">
          <summary>
            {es ? "Operadores por destino" : "Operators by destination"}
          </summary>
          <div
            className="plan-regional-networks"
            tabIndex={0}
            role="region"
            aria-label={es ? "Redes por país" : "Networks by country"}
          >
            {details.networks.map((group, index) => (
              <div key={index}>
                <h4>
                  {group.countryCode
                    ? countryName(group.countryCode)
                    : group.countryName}
                </h4>
                {operators(group)}
                {!group.countryCode && (
                  <p className="selected-plan-note">
                    {es
                      ? "Etiqueta regional del proveedor; correspondencia con la cobertura pendiente de confirmar."
                      : "Provider region label; mapping to the included coverage still needs confirmation."}
                  </p>
                )}
              </div>
            ))}
          </div>
        </details>
      ) : (
        details.networks.map((group, index) => (
          <div key={index}>{operators(group)}</div>
        ))
      )}
      {technologyDifference && (
        <p className="plan-network-caution">
          {es
            ? "El proveedor indica tecnologías distintas para el plan y algunas redes de operadores. La disponibilidad de esas tecnologías adicionales en este plan está pendiente de confirmar."
            : "The provider lists different technologies for the plan and some operator networks. Availability of those additional technologies on this plan still needs confirmation."}
        </p>
      )}
      <p className="selected-plan-note">
        {es
          ? "Redes indicadas por el proveedor. La señal y la tecnología disponible dependen del lugar, la red y tu equipo."
          : "Networks listed by the provider. Signal and available technology depend on your location, the network and your device."}
      </p>
    </>
  );
}
