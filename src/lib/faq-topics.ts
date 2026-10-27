export const faqTopicSegments = {
  basics: { en: "getting-started", es: "primeros-pasos" },
  simcoins: { en: "simcoins", es: "simcoins" },
  compatibility: {
    en: "phones-and-compatibility",
    es: "telefonos-y-compatibilidad",
  },
  installation: {
    en: "installation-and-activation",
    es: "instalacion-y-activacion",
  },
  data: { en: "data-and-plans", es: "datos-y-planes" },
  travel: { en: "during-your-trip", es: "durante-tu-viaje" },
  connection: {
    en: "connection-and-troubleshooting",
    es: "conexion-y-soluciones",
  },
} as const;
export type FAQTopic = keyof typeof faqTopicSegments;
export function isFAQTopic(value: string): value is FAQTopic {
  return Object.hasOwn(faqTopicSegments, value);
}
