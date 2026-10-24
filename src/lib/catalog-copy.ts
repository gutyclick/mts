export const catalogCopy = {
  en: {
    title: "Explore the plan catalog",
    description:
      "Find a country or choose a regional plan for a trip with more than one stop.",
    countryIntro:
      "Explore {count} data plans for {name}. Compare allowances and durations to find the right fit.",
    regionIntro:
      "Explore {count} regional plans for {name}. Check the exact coverage before choosing a package.",
    all: "All",
    countries: "Countries",
    regions: "Regions",
    plans: "plans",
    plan: "plan",
    fixed: "Fixed data",
    daily: "Daily data",
    planType: "Plan type",
    perDay: "/ day",
    days: "days",
    day: "day",
    data: "Data allowance",
    duration: "Duration",
    planName: "Plan name",
    destination: "Destination",
    coverageType: "Coverage type",
    country: "Country / territory",
    region: "Regional package",
    allData: "All data",
    allDurations: "Any duration",
    details: "View plan",
    back: "Back to plans",
    reset: "Reset filters",
    empty:
      "No plans match these filters. Try another allowance, duration or plan type.",
    fixedDescription: "A total data allowance for the duration shown.",
    dailyDescription:
      "A daily data allowance under a fair use policy (FUP). Check the exact package conditions before activation.",
    sourceNote:
      "Plan information from our catalog. Purchases are not available yet. Exact coverage and activation conditions must be confirmed before purchase.",
    coverageNote:
      "This catalog identifies the country or region. A detailed list of included countries and operators is not provided for every regional package.",
    fup: "Fair use policy",
    fupNote:
      "This package has a daily allowance and a fair use policy. Do not interpret it as unrestricted high-speed data. Refer to the exact plan conditions for any reduced-speed allowance.",
    loadMore: "Show more destinations",
    showing: "Showing",
    of: "of",
    directoryEmpty:
      "No destinations match your search. Try a country name in English or Spanish.",
    prepare: "A little help before you go",
    prepareDescription:
      "Keep exploring here. Find the details in our dedicated guides.",
    how: "How it works",
    howDescription: "From choosing a plan to getting connected.",
    compatibility: "Check your phone",
    compatibilityDescription: "Find out what to check before choosing an eSIM.",
    faq: "Questions, answered",
    faqDescription: "Installation, data, activation and more.",
    help: "Help center",
    helpDescription: "Choose a topic and find the information you need.",
  },
  es: {
    title: "Explora el catálogo de planes",
    description:
      "Busca un país o elige un plan regional para un viaje con varias paradas.",
    countryIntro:
      "Explora {count} planes de datos para {name}. Compara los datos y la duración para encontrar tu opción.",
    regionIntro:
      "Explora {count} planes regionales para {name}. Revisa la cobertura exacta antes de elegir un paquete.",
    all: "Todos",
    countries: "Países",
    regions: "Regiones",
    plans: "planes",
    plan: "plan",
    fixed: "Datos fijos",
    daily: "Datos diarios",
    planType: "Tipo de plan",
    perDay: "/ día",
    days: "días",
    day: "día",
    data: "Cantidad de datos",
    duration: "Duración",
    planName: "Nombre del plan",
    destination: "Destino",
    coverageType: "Tipo de cobertura",
    country: "País / territorio",
    region: "Paquete regional",
    allData: "Todos los datos",
    allDurations: "Cualquier duración",
    details: "Ver plan",
    back: "Volver a los planes",
    reset: "Restablecer filtros",
    empty:
      "No hay planes con estos filtros. Prueba otros datos, duración o tipo de plan.",
    fixedDescription: "Una cantidad total de datos para la duración indicada.",
    dailyDescription:
      "Una cantidad de datos diaria con política de uso justo (FUP). Revisa las condiciones específicas del paquete antes de activarlo.",
    sourceNote:
      "Información de nuestro catálogo de planes. Las compras todavía no están disponibles. La cobertura exacta y las condiciones de activación deben confirmarse antes de comprar.",
    coverageNote:
      "Este catálogo identifica el país o la región. No todos los paquetes regionales incluyen una lista detallada de países y operadores.",
    fup: "Política de uso justo",
    fupNote:
      "Este paquete tiene datos diarios y una política de uso justo. No equivale a datos de alta velocidad sin límites. Revisa las condiciones del plan para conocer cualquier acceso a velocidad reducida.",
    loadMore: "Ver más destinos",
    showing: "Mostrando",
    of: "de",
    directoryEmpty:
      "No encontramos destinos para tu búsqueda. Prueba el nombre del país en español o inglés.",
    prepare: "Una mano antes de viajar",
    prepareDescription:
      "Explora aquí y encuentra los detalles en nuestras guías.",
    how: "Cómo funciona",
    howDescription: "Desde elegir tu plan hasta conectarte.",
    compatibility: "Revisa tu teléfono",
    compatibilityDescription: "Qué comprobar antes de elegir una eSIM.",
    faq: "Resuelve tus dudas",
    faqDescription: "Instalación, datos, activación y más.",
    help: "Centro de ayuda",
    helpDescription: "Elige un tema y encuentra la información que necesitas.",
  },
};
export function destinationIntro(
  locale: "en" | "es",
  name: string,
  count: number,
  regional = false,
) {
  return catalogCopy[locale][regional ? "regionIntro" : "countryIntro"]
    .replace("{name}", name)
    .replace("{count}", String(count));
}
