export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];
export const isLocale = (value: string): value is Locale =>
  locales.includes(value as Locale);
export const routeSegments = {
  destinations: { en: "destinations", es: "destinos" },
  how: { en: "how-it-works", es: "como-funciona" },
  compatibility: { en: "compatibility", es: "compatibilidad" },
  help: { en: "help", es: "ayuda" },
  terms: { en: "terms", es: "terminos" },
  privacy: { en: "privacy", es: "privacidad" },
  refunds: { en: "refunds", es: "reembolsos" },
} as const;
export type PageKey = keyof typeof routeSegments;
export function pathFor(locale: Locale, page?: PageKey, slug?: string) {
  return slug
    ? `/${locale}/esim/${slug}`
    : page
      ? `/${locale}/${routeSegments[page][locale]}`
      : `/${locale}`;
}
export function equivalentPath(path: string, locale: Locale) {
  const [, , section, slug] = path.split("/");
  if (section === "esim" && slug) return pathFor(locale, undefined, slug);
  const key = (Object.keys(routeSegments) as PageKey[]).find((key) =>
    Object.values(routeSegments[key]).some((value) => value === section),
  );
  return pathFor(locale, key);
}
export const dictionaries = {
  en: {
    nav: {
      destinations: "Destinations",
      how: "How it works",
      compatibility: "Compatibility",
      help: "Help",
      terms: "Terms of service",
      privacy: "Privacy policy",
      refunds: "Refund policy",
    },
    find: "Find your eSIM",
    menu: "Open navigation",
    close: "Close",
    skip: "Skip to content",
    language: "Change language",
    eyebrow: "GLOBAL eSIM FOR MODERN TRAVELERS",
    heroStart: "Stay connected,",
    heroAccent: "wherever",
    heroEnd: "you go.",
    heroDescription:
      "Explore affordable eSIM plans for your next adventure. Stay connected wherever your journey takes you.",
    destination: "Where are you headed?",
    searchPlaceholder: "Search a country or region",
    duration: "Trip duration",
    optional: "Any duration",
    days: "days",
    day: "day",
    searchEmpty: "No destinations found. Try another country or region.",
    results: "Matching destinations",
    browse: "Browse all destinations",
    popularSearch: "Popular:",
    heroNote: "Less roaming. More exploring.",
    visualTag: "Your next adventure, connected.",
    visualStatus: "Ready for takeoff",
    visualLabel: "A little data. A world of possibilities.",
    trust: [
      {
        title: "Instant digital delivery",
        body: "No physical SIM. No waiting.",
      },
      { title: "Secure checkout", body: "Built for peace of mind." },
      { title: "Easy installation", body: "A few taps and you're ready." },
    ],
    previewNotice:
      "You're exploring our preview catalog. Prices and plans are illustrative; checkout is not yet available.",
    popularTitle: "Explore popular destinations",
    popularDescription:
      "Big city weekends or off-the-grid adventures. Find your connection.",
    allDestinations: "All destinations",
    from: "From",
    samplePrice: "Sample price",
    region: "Regional plan",
    country: "Country plan",
    stepsEyebrow: "SMALL SETUP. BIG ADVENTURES.",
    stepsTitle: "Get connected in 3 simple steps",
    stepsDescription:
      "Your travel plans are complicated enough. Staying connected shouldn't be.",
    steps: [
      {
        title: "Choose your destination",
        body: "Find a data plan that fits where you're going and how long you're staying.",
      },
      {
        title: "Buy your eSIM",
        body: "Once checkout launches, you'll be able to pay online and receive installation details.",
      },
      {
        title: "Scan and connect",
        body: "Follow the installation guide, then activate according to your plan's terms.",
      },
    ],
    whyEyebrow: "MADE FOR THE WAY YOU TRAVEL",
    whyTitle: "More exploring.\nLess overthinking.",
    whyDescription:
      "Maps, messages, and the moments in between. Keep the essentials close, wherever you land.",
    benefits: [
      {
        title: "Your trip, your data",
        body: "Compare data allowances and durations to find your fit.",
      },
      {
        title: "Go a little further",
        body: "Explore country and regional options in one place.",
      },
      {
        title: "Skip the SIM swap",
        body: "Install digitally on a compatible, unlocked phone.",
      },
      {
        title: "Keep things clear",
        body: "See the data, validity, and price before you decide.",
      },
    ],
    faqTitle: "A few things you might be wondering",
    faqDescription: "A little clarity before your next big trip.",
    faqs: [
      {
        question: "What is an eSIM?",
        answer:
          "An eSIM is a digital SIM profile installed on a compatible device. Travel data plans can provide mobile internet without replacing your physical SIM. Features depend on the plan.",
      },
      {
        question: "How do I install my eSIM?",
        answer:
          "Installation usually uses a QR code or manual details in your device's mobile settings. You'll need an internet connection during setup. Follow the instructions supplied with your specific plan.",
      },
      {
        question: "Is my phone compatible?",
        answer:
          "Your phone must support eSIM and be unlocked by your carrier. Compatibility varies by model and purchase region. Check your device settings and the manufacturer's specifications before purchasing.",
      },
      {
        question: "Can I keep my WhatsApp number?",
        answer:
          "Generally, you can keep using WhatsApp with your existing registered number over a new data connection. Keep your existing account and do not change its registered number when prompted by your device.",
      },
      {
        question: "When does my eSIM activate?",
        answer:
          "Activation rules vary. Some plans begin at installation; others begin when connecting to a supported network. Review the exact plan terms before installation. Our preview does not promise a specific activation rule.",
      },
    ],
    footerDescription: "A world to explore.\nA simpler way to stay connected.",
    explore: "Explore",
    useful: "Good to know",
    legal: "Legal",
    company: "A travel brand by YellowCat Enterprises LLC.",
    rights: "All rights reserved.",
    footerTag: "Made for curious travelers.",
    destinationsTitle: "Where will you go next?",
    destinationsDescription:
      "Explore our preview collection of country and regional eSIM plans.",
    plans: "Find your travel plan",
    plansDescription: "Choose the data and duration that fit your adventure.",
    demo: "Preview catalog",
    demoDetails:
      "Illustrative plans and USD prices. Supplier networks, activation rules, coverage and top-ups are not confirmed. No purchases are available.",
    data: "Data allowance",
    validity: "Validity",
    allData: "All data amounts",
    allDurations: "All durations",
    viewPlan: "View plan",
    details: "Plan details",
    network: "Network",
    unconfirmed: "To be confirmed by supplier",
    activation: "Activation",
    topup: "Top-up eligibility",
    checkout: "Checkout is not active",
    checkoutBody:
      "This is a preview plan. Payments and eSIM delivery are not available yet. No order has been created and you have not been charged.",
    gotIt: "Back to plans",
    planEmpty:
      "No plans match these filters. Try a different data amount or duration.",
    reset: "Reset filters",
    compatibleReminder: "Before you choose: check your phone",
    compatibleBody: "You need an eSIM-compatible, carrier-unlocked device.",
    checkCompatibility: "Check compatibility",
    coverage: "Coverage overview",
    coverageSample:
      "Preview coverage only. Exact countries, operators and coverage must be confirmed with the supplier before sale.",
    planFaq: "Before you connect",
    dataOnly: "Data-only preview plan",
    back: "All destinations",
    planCount: "preview plans",
    selectedTrip: "Trip preference",
    clear: "Clear search",
    howTitle: "Less setup. More seeing the world.",
    howDescription:
      "A simple guide to choosing, installing, and using a travel eSIM.",
    howChecklist: "Before you travel",
    howItems: [
      "Check that your device supports eSIM and is carrier-unlocked.",
      "Read your plan's coverage, validity, and activation conditions.",
      "Connect to reliable Wi-Fi before installing your eSIM.",
      "Keep your installation details and follow your plan-specific guide.",
    ],
    compatibilityTitle: "A quick check before you pack.",
    compatibilityDescription:
      "eSIM support depends on your exact device, carrier, and purchase region. Confirm all three before buying.",
    compatibilitySteps: [
      {
        title: "Look for Add eSIM",
        body: "On iPhone, check Settings → Cellular/Mobile Data. On Android, look under Settings → Connections/Network → SIM manager. Menu names vary.",
      },
      {
        title: "Check your carrier lock",
        body: "On iPhone, look for No SIM restrictions in Settings → General → About. On Android, check with your carrier. An eSIM option alone doesn't confirm that your phone is unlocked.",
      },
      {
        title: "Confirm the exact model",
        body: "Check your manufacturer's official specifications for your model and purchase region. Some regional versions do not support eSIM, even when similarly named models do.",
      },
    ],
    compatibilityNote:
      "We don't maintain a verified device database yet. These checks are guidance and do not guarantee compatibility.",
    helpTitle: "A little help for the journey.",
    helpDescription:
      "Start with the essentials. Our guides cover the questions travelers ask before choosing an eSIM.",
    helpCards: [
      {
        title: "New to eSIM?",
        body: "Walk through the basics, from choosing a plan to getting connected.",
      },
      {
        title: "Check your device",
        body: "Make sure your phone is ready for a digital SIM before you buy.",
      },
    ],
    helpNote:
      "Order support will be available when purchases launch. We are not accepting orders or payment in this preview.",
    legalDraft: "Draft — not effective commercial terms",
    legalIntro:
      "This page describes the current preview only. Final policies must be reviewed and published before commercial launch.",
    legalContent: {
      terms:
        "MyTripSim is a brand of YellowCat Enterprises LLC. This website currently presents an illustrative eSIM catalog. You cannot place orders, make payments, or provision eSIMs. Product availability, prices, coverage, activation conditions, and fulfillment terms are not final. Binding purchase terms will be published before checkout becomes available.",
      privacy:
        "This implementation does not include accounts, analytics, marketing trackers, or payment collection. Hosting providers may process technical request information such as IP addresses and access logs. A complete privacy notice identifying processors, retention periods, applicable rights, and a verified contact channel must be published before launch. Do not enter personal information into the destination search.",
      refunds:
        "No payments are accepted in this preview, so no orders or refunds can be processed here. Before sales begin, a reviewed refund policy will define eligibility, activation and usage conditions, request procedures, timelines, and applicable consumer rights. This draft does not promise refunds for future products.",
    },
    notFound: "This destination isn't on the map.",
    notFoundBody:
      "The page may have moved. Explore our available destinations to find your next trip.",
    home: "Back to home",
  },
  es: {
    nav: {
      destinations: "Destinos",
      how: "Cómo funciona",
      compatibility: "Compatibilidad",
      help: "Ayuda",
      terms: "Términos del servicio",
      privacy: "Privacidad",
      refunds: "Reembolsos",
    },
    find: "Encuentra tu eSIM",
    menu: "Abrir navegación",
    close: "Cerrar",
    skip: "Ir al contenido",
    language: "Cambiar idioma",
    eyebrow: "eSIM GLOBAL PARA VIAJEROS MODERNOS",
    heroStart: "Sigue conectado,",
    heroAccent: "dondequiera",
    heroEnd: "que vayas.",
    heroDescription:
      "Explora planes eSIM para tu próxima aventura. Mantente conectado, sin importar adónde te lleve el viaje.",
    destination: "¿Cuál es tu próximo destino?",
    searchPlaceholder: "Busca un país o región",
    duration: "Duración del viaje",
    optional: "Cualquier duración",
    days: "días",
    day: "día",
    searchEmpty: "No encontramos destinos. Prueba otro país o región.",
    results: "Destinos encontrados",
    browse: "Ver todos los destinos",
    popularSearch: "Populares:",
    heroNote: "Menos roaming. Más aventuras.",
    visualTag: "Tu próxima aventura, conectada.",
    visualStatus: "Listos para despegar",
    visualLabel: "Un poco de datos. Un mundo de posibilidades.",
    trust: [
      {
        title: "Entrega digital inmediata",
        body: "Sin tarjeta física ni esperas.",
      },
      { title: "Pago seguro", body: "Diseñado para tu tranquilidad." },
      { title: "Instalación sencilla", body: "Unos pasos y a explorar." },
    ],
    previewNotice:
      "Estás explorando nuestro catálogo de prueba. Los precios y planes son ilustrativos; el pago aún no está disponible.",
    popularTitle: "Explora los destinos favoritos",
    popularDescription:
      "Escapadas urbanas o aventuras lejanas. Encuentra tu conexión.",
    allDestinations: "Todos los destinos",
    from: "Desde",
    samplePrice: "Precio de ejemplo",
    region: "Plan regional",
    country: "Plan nacional",
    stepsEyebrow: "POCOS PASOS. GRANDES AVENTURAS.",
    stepsTitle: "Conéctate en 3 sencillos pasos",
    stepsDescription:
      "Planear un viaje ya tiene suficientes detalles. Conectarte debería ser fácil.",
    steps: [
      {
        title: "Elige tu destino",
        body: "Encuentra un plan que se ajuste a tu destino y a los días de tu viaje.",
      },
      {
        title: "Compra tu eSIM",
        body: "Cuando habilitemos el pago, podrás comprar y recibir las instrucciones en línea.",
      },
      {
        title: "Escanea y conéctate",
        body: "Sigue la guía de instalación y activa el plan según sus condiciones.",
      },
    ],
    whyEyebrow: "PARA TU FORMA DE VIAJAR",
    whyTitle: "Más aventuras.\nMenos complicaciones.",
    whyDescription:
      "Mapas, mensajes y todo lo que pasa entre ellos. Lleva lo esencial contigo, aterrices donde aterrices.",
    benefits: [
      {
        title: "Tu viaje, tus datos",
        body: "Compara datos y duración para encontrar tu plan.",
      },
      {
        title: "Llega más lejos",
        body: "Explora opciones nacionales y regionales en un solo lugar.",
      },
      {
        title: "Sin cambiar tu SIM",
        body: "Instala digitalmente en un teléfono compatible y desbloqueado.",
      },
      {
        title: "Todo claro",
        body: "Consulta datos, vigencia y precio antes de decidir.",
      },
    ],
    faqTitle: "Quizás te estás preguntando…",
    faqDescription: "Resuelve tus dudas antes de tu próxima aventura.",
    faqs: [
      {
        question: "¿Qué es una eSIM?",
        answer:
          "Una eSIM es un perfil SIM digital que instalas en un dispositivo compatible. Los planes de viaje pueden darte internet móvil sin reemplazar tu tarjeta física. Las funciones dependen del plan.",
      },
      {
        question: "¿Cómo instalo mi eSIM?",
        answer:
          "Normalmente se instala con un código QR o datos manuales en los ajustes móviles del dispositivo. Necesitarás internet durante la instalación. Sigue las instrucciones de tu plan específico.",
      },
      {
        question: "¿Mi teléfono es compatible?",
        answer:
          "Tu teléfono debe admitir eSIM y estar desbloqueado por el operador. La compatibilidad varía según el modelo y la región de compra. Revisa los ajustes y las especificaciones del fabricante antes de comprar.",
      },
      {
        question: "¿Puedo conservar mi número de WhatsApp?",
        answer:
          "Generalmente puedes seguir usando WhatsApp con tu número registrado mediante una nueva conexión de datos. Conserva tu cuenta y no cambies el número registrado al configurar tu dispositivo.",
      },
      {
        question: "¿Cuándo se activa mi eSIM?",
        answer:
          "Las condiciones varían: algunos planes empiezan al instalarse; otros al conectarse a una red compatible. Revisa las condiciones exactas antes de instalarla. El catálogo de prueba no garantiza una regla de activación específica.",
      },
    ],
    footerDescription:
      "Un mundo por explorar.\nUna forma más fácil de conectarte.",
    explore: "Explora",
    useful: "Información útil",
    legal: "Legal",
    company: "Una marca de YellowCat Enterprises LLC.",
    rights: "Todos los derechos reservados.",
    footerTag: "Para viajeros curiosos.",
    destinationsTitle: "¿Cuál será tu próxima aventura?",
    destinationsDescription:
      "Explora nuestra selección de prueba de planes eSIM nacionales y regionales.",
    plans: "Encuentra tu plan de viaje",
    plansDescription: "Elige los datos y la duración para tu próxima aventura.",
    demo: "Catálogo de prueba",
    demoDetails:
      "Planes y precios en USD ilustrativos. Las redes, activación, cobertura y recargas no están confirmadas por el proveedor. No se pueden realizar compras.",
    data: "Cantidad de datos",
    validity: "Vigencia",
    allData: "Todos los datos",
    allDurations: "Todas las duraciones",
    viewPlan: "Ver plan",
    details: "Detalles del plan",
    network: "Red",
    unconfirmed: "Por confirmar con el proveedor",
    activation: "Activación",
    topup: "Posibilidad de recarga",
    checkout: "El pago aún no está disponible",
    checkoutBody:
      "Este es un plan de prueba. Los pagos y la entrega de eSIM aún no están disponibles. No se ha creado un pedido ni realizado ningún cobro.",
    gotIt: "Volver a los planes",
    planEmpty:
      "No hay planes para estos filtros. Prueba otra cantidad de datos o duración.",
    reset: "Restablecer filtros",
    compatibleReminder: "Antes de elegir: revisa tu teléfono",
    compatibleBody:
      "Necesitas un dispositivo compatible con eSIM y desbloqueado.",
    checkCompatibility: "Revisar compatibilidad",
    coverage: "Información de cobertura",
    coverageSample:
      "Cobertura ilustrativa. Los países, operadores y cobertura exactos deben confirmarse con el proveedor antes de la venta.",
    planFaq: "Antes de conectarte",
    dataOnly: "Plan de prueba: solo datos",
    back: "Todos los destinos",
    planCount: "planes de prueba",
    selectedTrip: "Preferencia de viaje",
    clear: "Borrar búsqueda",
    howTitle: "Menos preparativos. Más mundo.",
    howDescription:
      "Una guía sencilla para elegir, instalar y usar tu eSIM de viaje.",
    howChecklist: "Antes de viajar",
    howItems: [
      "Verifica que tu dispositivo admita eSIM y esté desbloqueado.",
      "Revisa la cobertura, vigencia y condiciones de activación del plan.",
      "Conéctate a una red Wi-Fi confiable antes de instalar tu eSIM.",
      "Guarda los datos de instalación y sigue la guía de tu plan.",
    ],
    compatibilityTitle: "Una revisión antes de hacer la maleta.",
    compatibilityDescription:
      "La compatibilidad depende del dispositivo, el operador y la región de compra. Confirma los tres antes de comprar.",
    compatibilitySteps: [
      {
        title: "Busca Añadir eSIM",
        body: "En iPhone, revisa Ajustes → Datos móviles. En Android, busca Ajustes → Conexiones/Red → Administrador de SIM. Los nombres de los menús varían.",
      },
      {
        title: "Revisa el bloqueo del operador",
        body: "En iPhone, busca Sin restricciones de SIM en Ajustes → General → Información. En Android, consulta a tu operador. Tener la opción eSIM no confirma que esté desbloqueado.",
      },
      {
        title: "Confirma el modelo exacto",
        body: "Revisa las especificaciones oficiales del fabricante para tu modelo y región de compra. Algunas versiones regionales no admiten eSIM aunque otros modelos similares sí.",
      },
    ],
    compatibilityNote:
      "Aún no contamos con una base de dispositivos verificados. Estas indicaciones orientan y no garantizan la compatibilidad.",
    helpTitle: "Una mano para el camino.",
    helpDescription:
      "Empieza por lo esencial. Nuestras guías responden las dudas comunes antes de elegir una eSIM.",
    helpCards: [
      {
        title: "¿Es tu primera eSIM?",
        body: "Conoce lo básico, desde elegir un plan hasta conectarte.",
      },
      {
        title: "Revisa tu dispositivo",
        body: "Comprueba que tu teléfono esté listo para una SIM digital.",
      },
    ],
    helpNote:
      "La atención de pedidos estará disponible al iniciar las ventas. En esta versión no aceptamos pedidos ni pagos.",
    legalDraft: "Borrador — no son condiciones comerciales vigentes",
    legalIntro:
      "Esta página describe únicamente la versión de prueba. Las políticas definitivas deben revisarse y publicarse antes del lanzamiento comercial.",
    legalContent: {
      terms:
        "MyTripSim es una marca de YellowCat Enterprises LLC. Este sitio presenta un catálogo ilustrativo de eSIM. No se pueden realizar pedidos, pagos ni activar eSIM. La disponibilidad, precios, cobertura, condiciones de activación y entrega no son definitivos. Las condiciones vinculantes se publicarán antes de habilitar las compras.",
      privacy:
        "Esta implementación no incluye cuentas, analítica, rastreadores publicitarios ni recopilación de pagos. El alojamiento puede procesar información técnica como direcciones IP y registros de acceso. Antes del lanzamiento se debe publicar un aviso completo con encargados del tratamiento, plazos de conservación, derechos aplicables y un contacto verificado. No introduzcas información personal en la búsqueda de destinos.",
      refunds:
        "En esta versión de prueba no se aceptan pagos, por lo que no se procesan pedidos ni reembolsos. Antes de iniciar las ventas, una política revisada definirá la elegibilidad, condiciones de activación y uso, procedimientos, plazos y derechos del consumidor aplicables. Este borrador no promete reembolsos para productos futuros.",
    },
    notFound: "Esta página no está en el mapa.",
    notFoundBody:
      "Puede que se haya movido. Explora nuestros destinos para encontrar tu próximo viaje.",
    home: "Volver al inicio",
  },
};
export type Dictionary = (typeof dictionaries)[Locale];
