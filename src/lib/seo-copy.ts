import type { Locale, PageKey } from "./i18n";

const copy = {
  es: {
    destinations: [
      "Destinos eSIM: planes por país y región",
      "Encuentra tu eSIM de viaje por país o región. Compara datos, duración, variantes y redes, y consulta la cobertura de cada plan antes de elegir.",
    ],
    how: [
      "Cómo funciona una eSIM de viaje | Guía MyTripSim",
      "Descubre cómo elegir, instalar y usar una eSIM de viaje. Verifica tu teléfono, compara los planes de datos y prepara tu conexión antes de viajar.",
    ],
    compatibility: [
      "Móviles compatibles con eSIM: comprueba tu modelo",
      "Comprueba si tu iPhone, Samsung, Google Pixel u otro móvil admite eSIM. Consulta modelos, variantes regionales y requisitos de desbloqueo.",
    ],
    faq: [
      "Preguntas frecuentes sobre eSIM de viaje",
      "Resuelve tus dudas sobre eSIM: compatibilidad, instalación, activación, datos, roaming y conexión. Encuentra respuestas organizadas por tema en MyTripSim.",
    ],
    help: [
      "Ayuda eSIM: instalación, conexión y pedidos",
      "Encuentra ayuda para instalar tu eSIM, configurar los datos o consultar un pedido de MyTripSim. Explora las guías y contacta con nuestro equipo.",
    ],
  },
  en: {
    destinations: [
      "eSIM destinations: plans by country and region",
      "Find a travel eSIM by country or region. Compare data, validity, variants and networks, and check each plan’s coverage before choosing.",
    ],
    how: [
      "How travel eSIMs work | MyTripSim guide",
      "Learn how to choose, install and use a travel eSIM. Check your phone, compare data plans and prepare your connection before you travel.",
    ],
    compatibility: [
      "eSIM-compatible phones: check your model",
      "Check whether your iPhone, Samsung, Google Pixel or other phone supports eSIM. Review supported models, regional variants and carrier unlock requirements.",
    ],
    faq: [
      "Travel eSIM frequently asked questions",
      "Get answers about travel eSIM compatibility, installation, activation, data, roaming and connectivity. Browse MyTripSim questions by topic.",
    ],
    help: [
      "eSIM help: installation, connection and orders",
      "Get help installing your eSIM, setting up mobile data or checking a MyTripSim order. Explore our guides and contact the support team.",
    ],
  },
} satisfies Record<Locale, Partial<Record<PageKey, [string, string]>>>;

export function publicPageCopy(
  locale: Locale,
  page: PageKey,
): [string, string] | undefined {
  return (copy[locale] as Partial<Record<PageKey, [string, string]>>)[page];
}
