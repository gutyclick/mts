import { faqTopicSegments, type FAQTopic } from "./faq-topics.ts";
import { authSegments, authPath, type AuthMode } from "./auth-routes.ts";
export const locales = ["en", "es"] as const;
export type Locale = (typeof locales)[number];
export const isLocale = (value: string): value is Locale =>
  locales.includes(value as Locale);
export const routeSegments = {
  destinations: { en: "destinations", es: "destinos" },
  how: { en: "how-it-works", es: "como-funciona" },
  compatibility: { en: "compatibility", es: "compatibilidad" },
  help: { en: "help", es: "ayuda" },
  faq: { en: "faq", es: "preguntas-frecuentes" },
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
  const [, , section, slug, planId] = path.split("/");
  if (section === "admin")
    return `/${locale}/admin${slug === "tickets" ? "/tickets" : ""}`;
  if (section === "support") return `/${locale}/support`;
  if (section === "checkout" && slug === "result")
    return `/${locale}/checkout/result`;
  const accountMode = (Object.keys(authSegments) as AuthMode[]).find((key) =>
    Object.values(authSegments[key]).some((value) => value === section),
  );
  if (accountMode) return authPath(locale, accountMode);
  if (section === "plan" && slug && planId)
    return `/${locale}/plan/${slug}/${planId}`;
  const experience = (Object.keys(experienceSegments) as ExperienceKey[]).find(
    (key) =>
      Object.values(experienceSegments[key]).some((value) => value === section),
  );
  if (experience) return experiencePath(locale, experience);
  if (section === "esim" && slug) return pathFor(locale, undefined, slug);
  const key = (Object.keys(routeSegments) as PageKey[]).find((key) =>
    Object.values(routeSegments[key]).some((value) => value === section),
  );
  if (key === "faq" && slug) {
    const topic = (Object.keys(faqTopicSegments) as FAQTopic[]).find((topic) =>
      Object.values(faqTopicSegments[topic]).some((value) => value === slug),
    );
    if (topic) return faqTopicPath(locale, topic);
  }
  return pathFor(locale, key);
}
export function faqTopicPath(locale: Locale, topic: FAQTopic) {
  return `${pathFor(locale, "faq")}/${faqTopicSegments[topic][locale]}`;
}
export const dictionaries = {
  en: {
    mobile: {
      navigation: "Main navigation",
      home: "Home",
      destinations: "Destinations",
      guide: "Guide",
      help: "Help",
      faq: "FAQ",
    },
    nav: {
      faq: "FAQ",
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
      "Find a little data for your next big adventure. Explore travel eSIMs and take your connection with you.",
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
        title: "Digital eSIM",
        body: "Travel without replacing your SIM.",
      },
      {
        title: "Device compatibility",
        body: "Check your phone before traveling.",
      },
      {
        title: "Countries & regions",
        body: "Find a plan for your destination.",
      },
      { title: "Clear plan details", body: "The details, before you decide." },
    ],
    previewNotice:
      "Find your destination and choose the data plan for your trip.",
    popularTitle: "Explore popular destinations",
    popularDescription: "A city break or a bigger adventure. Start here.",
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
        body: "Pick your destination and a plan that fits your trip.",
      },
      {
        title: "Compare your plans",
        body: "Compare data, validity and plan variants before choosing.",
      },
      {
        title: "Scan and connect",
        body: "Install with your guide. Activate when your plan's terms say to.",
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
          "Activation rules vary. Some plans begin at installation; others begin when connecting to a supported network. Review the exact plan terms before installation. Check the validity start shown for your selected plan.",
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
      "Explore our country and regional travel eSIM plans.",
    plans: "Find your travel plan",
    plansDescription: "Choose the data and duration that fit your adventure.",
    demo: "eSIM catalog",
    demoDetails:
      "Prices are shown in USD. Review the coverage, activation and conditions for your selected plan.",
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
    checkout: "Complete your order",
    checkoutBody:
      "Review your plan and recipient details, then continue to secure payment.",
    gotIt: "Back to plans",
    planEmpty:
      "No plans match these filters. Try a different data amount or duration.",
    reset: "Reset filters",
    compatibleReminder: "Before you choose: check your phone",
    compatibleBody: "You need an eSIM-compatible, carrier-unlocked device.",
    checkCompatibility: "Check compatibility",
    coverage: "Coverage overview",
    coverageSample:
      "Review the included countries and operators for the selected plan.",
    planFaq: "Before you connect",
    dataOnly: "Data-only plan",
    back: "All destinations",
    planCount: "data plans",
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
      "Check your brand, exact model and purchase region in the checker. Some models have official documentation; others still need manufacturer confirmation. Guidance does not guarantee service on a specific device.",
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
      "Ask SIM for guidance, or create a support ticket to contact our team. Sign in to discuss a private order and keep your conversation history.",
    legalDraft: "Service information",
    legalIntro:
      "Information about MyTripSim services, purchases and customer assistance.",
    legalContent: {
      terms:
        "MyTripSim is a brand of YellowCat Enterprises LLC. Before purchasing, review your plan’s data allowance, validity, coverage and activation conditions, and confirm that your device supports eSIM and is carrier-unlocked. The total is shown before payment. Once payment is confirmed and the eSIM is prepared, installation details are sent to the recipient email. Keep your QR code private and follow the plan instructions. Contact hello@mytripsim.com about your order.",
      privacy:
        "MyTripSim processes account details, orders and support conversations to provide the service. Supabase stores account and support records; Resend sends service emails. SIM uses OpenAI to answer support questions: messages and limited details of your selected order may be processed by OpenAI. SIM cannot access installation codes or payment credentials. Do not share passwords, cards or QR codes in the chat. OpenAI may temporarily retain API data to prevent abuse. AI responses can be wrong; you can request human help. Hosting providers may process technical request information. Contact hello@mytripsim.com about your personal data. You may contact the same address to request access, correction or deletion of your personal information, subject to applicable legal obligations.",
      refunds:
        "For assistance with a purchase or a refund request, contact hello@mytripsim.com with your order reference and a description of the issue. Do not send card details or your installation QR. Our team will review the payment, eSIM issuance, installation and usage status, the plan conditions and applicable consumer rights before responding. Do not delete the eSIM while the issue is being reviewed unless our team instructs you to do so.",
    },
    notFound: "This destination isn't on the map.",
    notFoundBody:
      "The page may have moved. Explore our available destinations to find your next trip.",
    home: "Back to home",
  },
  es: {
    mobile: {
      navigation: "Navegación principal",
      home: "Inicio",
      destinations: "Destinos",
      guide: "Guía",
      help: "Ayuda",
      faq: "FAQ",
    },
    nav: {
      destinations: "Destinos",
      faq: "FAQ",
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
      "Un poco de datos para tu próxima gran aventura. Explora planes eSIM y lleva tu conexión contigo.",
    destination: "¿Cuál es tu próximo destino?",
    searchPlaceholder: "Busca un país o región",
    duration: "Duración del viaje",
    optional: "Opcional",
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
        title: "eSIM digital",
        body: "Viaja sin reemplazar tu SIM.",
      },
      {
        title: "Equipo compatible",
        body: "Revisa tu teléfono antes de viajar.",
      },
      { title: "Países y regiones", body: "Encuentra planes para tu destino." },
      { title: "Planes claros", body: "Los detalles, antes de elegir." },
    ],
    previewNotice:
      "Encuentra tu destino y elige el plan de datos para tu viaje.",
    popularTitle: "Explora los destinos favoritos",
    popularDescription:
      "Una escapada o una gran aventura. Tu viaje empieza aquí.",
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
        body: "Elige tu destino y un plan que se ajuste a tu viaje.",
      },
      {
        title: "Compara tus planes",
        body: "Compara datos, duración y variantes para elegir tu plan.",
      },
      {
        title: "Escanea y conéctate",
        body: "Instala con tu guía y activa según las condiciones del plan.",
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
          "Las condiciones varían: algunos planes empiezan al instalarse; otros al conectarse a una red compatible. Revisa las condiciones exactas antes de instalarla. Consulta el inicio de vigencia indicado en el plan seleccionado.",
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
      "Explora nuestros planes eSIM de viaje por país y región.",
    plans: "Encuentra tu plan de viaje",
    plansDescription: "Elige los datos y la duración para tu próxima aventura.",
    demo: "Catálogo eSIM",
    demoDetails:
      "Los precios se muestran en USD. Revisa la cobertura, la activación y las condiciones del plan seleccionado.",
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
    checkout: "Completa tu pedido",
    checkoutBody:
      "Revisa tu plan y el correo del beneficiario para continuar al pago seguro.",
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
    dataOnly: "Plan de solo datos",
    back: "Todos los destinos",
    planCount: "planes de datos",
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
      "Revisa tu marca, modelo exacto y región de compra en el verificador. Algunos modelos cuentan con documentación oficial; otros necesitan confirmación del fabricante. Esta orientación no garantiza el servicio en una unidad concreta.",
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
      "Consulta a SIM o crea un ticket para hablar con nuestro equipo. Inicia sesión para consultar un pedido privado y conservar el historial.",
    legalDraft: "Información del servicio",
    legalIntro:
      "Información sobre los servicios, las compras y la atención al cliente de MyTripSim.",
    legalContent: {
      terms:
        "MyTripSim es una marca de YellowCat Enterprises LLC. Antes de comprar, revisa los datos, la vigencia, la cobertura y las condiciones de activación del plan, y confirma que tu dispositivo admite eSIM y está liberado. El importe total se muestra antes de pagar. Tras confirmar el pago y preparar la eSIM, enviaremos las instrucciones al correo del beneficiario. Mantén privado el QR y sigue las instrucciones del plan. Para consultas sobre tu pedido, escribe a hello@mytripsim.com.",
      privacy:
        "MyTripSim trata los datos de cuenta, pedidos y conversaciones de ayuda para prestar el servicio. Supabase almacena cuentas y soporte; Resend envía correos del servicio. SIM usa OpenAI para responder consultas: los mensajes y datos limitados del pedido que selecciones pueden ser tratados por OpenAI. SIM no tiene acceso a los códigos de instalación ni a las credenciales de pago. No compartas contraseñas, tarjetas ni QR en el chat. OpenAI puede conservar temporalmente datos de la API para prevenir abusos. La IA puede equivocarse y puedes pedir ayuda humana. El alojamiento puede procesar información técnica de las solicitudes. Escribe a hello@mytripsim.com sobre tus datos personales. Puedes escribir a esa misma dirección para solicitar acceso, corrección o eliminación de tus datos, conforme a las obligaciones legales aplicables.",
      refunds:
        "Para recibir asistencia con una compra o solicitar un reembolso, escribe a hello@mytripsim.com con la referencia del pedido y una descripción del problema. No envíes datos de tarjeta ni tu QR de instalación. Nuestro equipo revisará el pago, la emisión, la instalación y el consumo de la eSIM, las condiciones del plan y los derechos aplicables antes de responder. No elimines la eSIM mientras se revisa el caso, salvo que nuestro equipo te lo indique.",
    },
    notFound: "Esta página no está en el mapa.",
    notFoundBody:
      "Puede que se haya movido. Explora nuestros destinos para encontrar tu próximo viaje.",
    home: "Volver al inicio",
  },
};
export type Dictionary = (typeof dictionaries)[Locale];
import {
  experienceSegments,
  experiencePath,
  type ExperienceKey,
} from "./experience-routes.ts";
