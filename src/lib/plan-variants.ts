import type { Locale } from "./i18n";
export function planVariant(
  plan: { id: string; name: string },
  locale: Locale,
) {
  const es = locale === "es";
  if (/_usip(?:_|$)/i.test(plan.id))
    return {
      label: /fifa/i.test(plan.id) ? "USIP · FIFA" : "USIP",
      description: es
        ? "La conexión sale a internet con una dirección IP de Estados Unidos. Indica la región de la IP, no la ubicación del dispositivo."
        : "Your connection reaches the internet using a United States IP address. This identifies the IP region, not the device’s location.",
    };
  if (/_nonhkip$/i.test(plan.id))
    return {
      label: "nonhkip",
      description: es
        ? "La conexión sale a internet por un país distinto de Hong Kong. Esa salida puede influir en la región que detectan las aplicaciones y los sitios web."
        : "Internet traffic exits through a country other than Hong Kong. This can affect the region detected by apps and websites.",
    };
  if (/_premium$/i.test(plan.id))
    return {
      label: "Premium",
      description: es
        ? "Variante multired del proveedor. Consulta en esta ficha qué operadores y tecnologías incluye para tu destino."
        : "The provider’s multi-network variant. Check the operators and technologies included for your destination in this plan’s details.",
    };
  if (/_iij$/i.test(plan.id))
    return {
      label: "IIJ",
      description: es
        ? "Variante de Japón identificada como IIJ por el proveedor, con IP de salida japonesa. Revisa su red, APN y momento de activación en la ficha."
        : "The provider’s Japan variant identified as IIJ, with a Japanese breakout IP. Check its network, APN and activation rules in the plan details.",
    };
  if (/_myip$/i.test(plan.id))
    return {
      label: "MYIP",
      description: es
        ? "La conexión sale a internet con una dirección IP de Malasia. Revisa cuándo empieza su vigencia antes de instalar o comprar."
        : "Internet traffic exits using a Malaysian IP address. Check when validity starts before installing or purchasing.",
    };
  const suffix = /\d+\s*days?\b\s*(.+)$/i
    .exec(plan.name)?.[1]
    .replace(/^\(|\)$/g, "")
    .trim();
  return {
    label: suffix || (es ? "Estándar" : "Standard"),
    description: es
      ? "Identifica la configuración de este plan. Consulta su cobertura, operadores y activación en la ficha."
      : "Identifies this plan’s configuration. Check its coverage, operators and activation rules in the plan details.",
  };
}
