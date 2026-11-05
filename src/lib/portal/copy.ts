export type PortalLocale = "es" | "en";
export type PortalView =
  | "home"
  | "trips"
  | "new"
  | "trip"
  | "request"
  | "review"
  | "team"
  | "billing"
  | "help"
  | "access";
export type PortalRoute = { view: PortalView; tripId?: string };

const paths = {
  es: {
    home: "",
    trips: "viajes",
    new: "viajes/nuevo",
    review: "revision",
    team: "equipo",
    billing: "facturacion",
    help: "soporte",
    access: "acceso",
  },
  en: {
    home: "",
    trips: "trips",
    new: "trips/new",
    review: "review",
    team: "team",
    billing: "billing",
    help: "support",
    access: "access",
  },
};
export function portalHref(
  locale: PortalLocale,
  base: string,
  view: PortalView,
  tripId?: string,
) {
  const path =
    view === "trip" || view === "request"
      ? `${paths[locale].trips}/${encodeURIComponent(tripId ?? "")}${view === "request" ? (locale === "es" ? "/solicitar" : "/request") : ""}`
      : paths[locale][view];
  return `${base}/${locale}${path ? `/${path}` : ""}`;
}
export function portalScreen(
  locale: PortalLocale,
  segments: string[],
): PortalRoute | null {
  const path = segments.join("/");
  for (const [view, value] of Object.entries(paths[locale]))
    if (path === value) return { view: view as PortalView };
  if (
    segments[0] === paths[locale].trips &&
    /^[a-zA-Z0-9-]{1,80}$/.test(segments[1] ?? "")
  ) {
    if (segments.length === 2) return { view: "trip", tripId: segments[1] };
    if (
      segments.length === 3 &&
      segments[2] === (locale === "es" ? "solicitar" : "request")
    )
      return { view: "request", tripId: segments[1] };
  }
  return null;
}
export const portalCopy = {
  es: {
    home: "Inicio",
    trips: "Viajes",
    new: "Crear viaje",
    review: "Revisión",
    team: "Equipo",
    billing: "Facturación",
    help: "Ayuda",
    access: "Acceso",
    trip: "Detalle del viaje",
    request: "Solicitar eSIM",
    preview: "Vista previa · Datos de ejemplo",
    previewDetail:
      "Prueba el recorrido. Los cambios se reinician al recargar; no se envían pedidos ni se emiten eSIM.",
    business: "Portal de empresas",
    company: "Agencia de ejemplo",
    workspace: "Tu espacio de viajes",
    headline: "Cada grupo, bien conectado.",
    welcome:
      "Organiza tus viajes y acompaña a cada viajero desde un solo lugar.",
    upcoming: "Próximos viajes",
    allTrips: "Ver todos los viajes",
    travelers: "Viajeros",
    assigned: "Asignadas",
    delivered: "Entregadas",
    activated: "Activadas",
    sold: "Ventas registradas",
    pending: "Por revisar",
    individual: "Venta individual",
    package: "Incluida en el paquete",
    draft: "Borrador",
    ready: "En distribución",
    approved: "Solicitud aprobada",
    changes: "Requiere cambios",
    pendingStatus: "Pendiente de revisión",
    tripName: "Nombre del viaje",
    destination: "Destino",
    departure: "Salida",
    returning: "Regreso",
    groupSize: "Número de viajeros",
    modality: "Modalidad del viaje",
    namePlaceholder: "Ej. Europa · Grupo de diciembre",
    destinationPlaceholder: "Ej. Europa, Japón o México",
    individualInfo:
      "Ofrece eSIM a quienes las necesiten. Registra las ventas por separado.",
    packageInfo: "Una eSIM para cada viajero, incluida en el viaje.",
    create: "Crear viaje",
    back: "Volver a viajes",
    details: "Ver viaje",
    search: "Buscar por viaje o destino",
    noResults: "No encontramos ese viaje.",
    noResultsHint: "Prueba con otro nombre o crea un viaje nuevo.",
    overview: "Resumen",
    people: "Viajeros y eSIM",
    orders: "Pedidos",
    distribution: "Distribución del grupo",
    providerNote:
      "La activación requiere confirmación del proveedor. Entregar el QR no significa que ya esté activo.",
    traveler: "Viajero",
    reference: "Referencia",
    state: "Estado",
    assignedState: "Asignada",
    deliveredState: "Entregada",
    activeState: "Activada",
    unassigned: "Sin asignar",
    export: "Descargar listado",
    exportHint:
      "CSV con referencias de ejemplo; no contiene QR ni datos de clientes.",
    requestTitle: "Prepara la conexión del grupo",
    requestInfo:
      "Elige una capacidad de ejemplo y cuántas eSIM necesitas para este viaje.",
    capacity: "Datos por eSIM",
    quantity: "Cantidad de eSIM",
    fullGroup: "El paquete cubre a todo el grupo.",
    requestButton: "Simular envío de solicitud",
    requestNote:
      "La tarifa, vigencia y disponibilidad se confirmarán al conectar el catálogo B2B.",
    summary: "Resumen de la solicitud",
    awaiting: "Tu solicitud de ejemplo está lista para revisión.",
    existingRequest: "Este viaje ya tiene una solicitud.",
    reviewLink: "Ver revisión de ejemplo",
    approvalNote:
      "La emisión requerirá aprobación administrativa y pago confirmado o crédito autorizado. Aprobar la solicitud no emite eSIM.",
    approve: "Simular aprobación",
    returnChanges: "Solicitar cambios de ejemplo",
    reviewTitle: "Una revisión, todo a la vista",
    reviewInfo:
      "Vista del flujo administrativo con solicitudes ficticias. No otorga permisos administrativos.",
    noPending: "No hay solicitudes pendientes.",
    reviewDone: "Revisión de ejemplo guardada. No se ha emitido ninguna eSIM.",
    nextSteps: "Antes de la salida",
    step1: "Crea el viaje y define el grupo",
    step2: "Solicita las eSIM para revisión",
    step3: "Distribuye y sigue las activaciones",
    teamTitle: "Un equipo, cada uno con su rol",
    teamInfo:
      "La siguiente fase conectará invitaciones y permisos por empresa.",
    role1: "Administrador de empresa",
    role1Info: "Gestiona el equipo y supervisa todos los viajes.",
    role2: "Coordinador de viaje",
    role2Info: "Prepara solicitudes y organiza la distribución.",
    role3: "Finanzas",
    role3Info: "Consulta importes, pagos y documentos comerciales.",
    billingTitle: "Las cuentas del viaje, en orden",
    billingInfo:
      "Cada pedido conservará su presupuesto, pago y documentos dentro del viaje correspondiente.",
    billingNote:
      "Esta vista previa no contiene facturas ni cobros. Las tarifas y condiciones B2B se acordarán antes de activar las compras.",
    helpTitle: "Aquí empieza una buena solución",
    helpInfo:
      "Escríbenos con el nombre de tu viaje y la referencia del pedido. Nunca envíes QR ni datos de tarjeta.",
    contact: "Contactar con el equipo",
    whatsapp: "WhatsApp directo",
    whatsappInfo:
      "Añadiremos el contacto de empresas cuando se confirme el número oficial.",
    accessTitle: "Tu próximo viaje empieza aquí",
    accessInfo:
      "Un espacio para coordinar grupos, solicitar eSIM y organizar cada entrega.",
    explore: "Explorar el portal de ejemplo",
    accessNote:
      "El acceso privado por empresa se conectará en la siguiente fase.",
    error:
      "Revisa el nombre, las fechas y el número de viajeros (entre 1 y 10.000).",
    requestError:
      "Revisa la cantidad y el estado del viaje antes de solicitar.",
    missing: "No encontramos este viaje en tu empresa.",
    showMore: "Ver más viajeros",
    showLess: "Ver menos",
    noOrder: "Este viaje todavía no tiene solicitudes.",
    issuance: "Preparación y entrega",
    issuanceInfo:
      "En el portal conectado podrás descargar fichas individuales o un ZIP y compartir enlaces privados. En esta vista previa no hay QR reales.",
    dateLabel: "Fecha de salida",
    menu: "Navegación principal",
    store: "Ir a MyTripSim",
    open: "Abrir",
    total: "Total solicitado",
    status: "Estado del pedido",
    language: "Cambiar a inglés",
    supportSubject: "Consulta del portal de empresas",
  },
  en: {
    home: "Overview",
    trips: "Trips",
    new: "Create trip",
    review: "Review",
    team: "Team",
    billing: "Billing",
    help: "Help",
    access: "Access",
    trip: "Trip details",
    request: "Request eSIMs",
    preview: "Preview · Example data",
    previewDetail:
      "Explore the workflow. Refreshing resets changes; no orders are sent or eSIMs issued.",
    business: "Business portal",
    company: "Example agency",
    workspace: "Your travel workspace",
    headline: "Every group, connected.",
    welcome: "Organize trips and look after every traveler in one place.",
    upcoming: "Upcoming trips",
    allTrips: "View all trips",
    travelers: "Travelers",
    assigned: "Assigned",
    delivered: "Delivered",
    activated: "Activated",
    sold: "Recorded sales",
    pending: "Awaiting review",
    individual: "Individual sale",
    package: "Included in package",
    draft: "Draft",
    ready: "Distributing",
    approved: "Request approved",
    changes: "Changes requested",
    pendingStatus: "Awaiting review",
    tripName: "Trip name",
    destination: "Destination",
    departure: "Departure",
    returning: "Return",
    groupSize: "Number of travelers",
    modality: "Trip model",
    namePlaceholder: "E.g. Europe · December group",
    destinationPlaceholder: "E.g. Europe, Japan or Mexico",
    individualInfo:
      "Offer eSIMs to travelers who need them. Track sales separately.",
    packageInfo: "One eSIM for every traveler, included in the trip.",
    create: "Create trip",
    back: "Back to trips",
    details: "View trip",
    search: "Search trips or destinations",
    noResults: "We couldn't find that trip.",
    noResultsHint: "Try another name or create a new trip.",
    overview: "Overview",
    people: "Travelers & eSIMs",
    orders: "Orders",
    distribution: "Group distribution",
    providerNote:
      "Activation requires provider confirmation. Delivering a QR code does not mean the eSIM is active.",
    traveler: "Traveler",
    reference: "Reference",
    state: "Status",
    assignedState: "Assigned",
    deliveredState: "Delivered",
    activeState: "Activated",
    unassigned: "Unassigned",
    export: "Download list",
    exportHint: "CSV with example references; no QR codes or customer details.",
    requestTitle: "Get your group connected",
    requestInfo:
      "Choose an example data allowance and the number of eSIMs for this trip.",
    capacity: "Data per eSIM",
    quantity: "Number of eSIMs",
    fullGroup: "The package covers the entire group.",
    requestButton: "Simulate request submission",
    requestNote:
      "Pricing, validity and availability will be confirmed when the B2B catalog is connected.",
    summary: "Request summary",
    awaiting: "Your example request is ready for review.",
    existingRequest: "This trip already has a request.",
    reviewLink: "Open example review",
    approvalNote:
      "Issuance will require administrator approval and confirmed payment or approved credit. Approving a request does not issue eSIMs.",
    approve: "Simulate approval",
    returnChanges: "Request example changes",
    reviewTitle: "Everything ready for review",
    reviewInfo:
      "An administrative workflow preview with fictional requests. This does not grant administrator permissions.",
    noPending: "No requests awaiting review.",
    reviewDone: "Example review saved. No eSIMs have been issued.",
    nextSteps: "Before departure",
    step1: "Create a trip and define the group",
    step2: "Request eSIMs for review",
    step3: "Distribute and track activations",
    teamTitle: "One team, clear responsibilities",
    teamInfo:
      "The next phase will connect invitations and company-specific permissions.",
    role1: "Company administrator",
    role1Info: "Manages the team and oversees every trip.",
    role2: "Trip coordinator",
    role2Info: "Prepares requests and organizes distribution.",
    role3: "Finance",
    role3Info: "Reviews amounts, payments and commercial documents.",
    billingTitle: "Trip finances, organized",
    billingInfo:
      "Each order will keep its quote, payment and documents within the corresponding trip.",
    billingNote:
      "This preview contains no invoices or payments. B2B pricing and terms will be agreed before purchases are activated.",
    helpTitle: "Good support starts here",
    helpInfo:
      "Contact us with your trip name and order reference. Never send QR codes or card details.",
    contact: "Contact the team",
    whatsapp: "Direct WhatsApp",
    whatsappInfo:
      "Business WhatsApp will be added once the official number is confirmed.",
    accessTitle: "Your next trip starts here",
    accessInfo:
      "A workspace to coordinate groups, request eSIMs and organize every delivery.",
    explore: "Explore the example portal",
    accessNote: "Private company access will be connected in the next phase.",
    error: "Check the name, dates and number of travelers (1 to 10,000).",
    requestError: "Check the quantity and trip status before requesting.",
    missing: "We couldn't find this trip in your company.",
    showMore: "Show more travelers",
    showLess: "Show less",
    noOrder: "This trip has no requests yet.",
    issuance: "Preparation & delivery",
    issuanceInfo:
      "The connected portal will offer individual files, ZIP downloads and private sharing links. There are no real QR codes in this preview.",
    dateLabel: "Departure date",
    menu: "Main navigation",
    store: "Go to MyTripSim",
    open: "Open",
    total: "Total requested",
    status: "Order status",
    language: "Switch to Spanish",
    supportSubject: "Business portal enquiry",
  },
} as const;
