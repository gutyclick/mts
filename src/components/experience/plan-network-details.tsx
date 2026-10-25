import Image from "next/image";
import type { Locale } from "@/lib/i18n";
import type { PlanDetails } from "@/lib/plan-utils";

export function PlanNetworkDetails({
  locale,
  details,
  regional,
  view,
}: {
  locale: Locale;
  details: PlanDetails;
  regional: boolean;
  view: "summary" | "technical";
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
  const networkTable = (groups: PlanDetails["networks"]) => (
    <table className="plan-network-table">
      <caption className="sr-only">
        {es ? "Redes indicadas por el proveedor" : "Provider-listed networks"}
      </caption>
      <thead>
        <tr>
          {regional && <th scope="col">{es ? "Destino" : "Destination"}</th>}
          <th scope="col">{es ? "Operador" : "Operator"}</th>
          <th scope="col">{es ? "Red" : "Network"}</th>
        </tr>
      </thead>
      {groups.map((group, index) => (
        <tbody key={index}>
          {group.operators.map((operator, operatorIndex) => (
            <tr key={`${operator.name}-${operatorIndex}`}>
              {regional && operatorIndex === 0 && (
                <th scope="rowgroup" rowSpan={group.operators.length}>
                  {group.countryCode
                    ? countryName(group.countryCode)
                    : group.countryName}
                  {!group.countryCode && (
                    <small>
                      {es
                        ? "Correspondencia por confirmar"
                        : "Mapping needs confirmation"}
                    </small>
                  )}
                </th>
              )}
              <td>{operator.name}</td>
              <td>
                <span className="network-generation">
                  {operator.technologies.join(" / ") ||
                    (es ? "Por confirmar" : "To confirm")}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
  return (
    <>
      {view === "summary" && regional && (
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
      {view === "technical" &&
        (regional ? (
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
              {networkTable(details.networks)}
            </div>
          </details>
        ) : (
          networkTable(details.networks)
        ))}
      {view === "summary" && technologyDifference && (
        <p className="plan-network-caution">
          {es
            ? "Algunas redes indican otra tecnología. Su disponibilidad en este plan está pendiente de confirmar."
            : "Some networks list a different technology. Its availability on this plan still needs confirmation."}
        </p>
      )}
      {view === "technical" && (
        <p className="selected-plan-note">
          {es
            ? "Redes indicadas por el proveedor. La señal y la tecnología disponible dependen del lugar, la red y tu equipo."
            : "Networks listed by the provider. Signal and available technology depend on your location, the network and your device."}
        </p>
      )}
    </>
  );
}
