import type { Destination } from "./catalog";
import type { Locale } from "./i18n";
import type { Plan } from "./plan-utils";

/** Aggregate only this destination's catalog; never imply every variant has the same networks. */
export function destinationContent(
  locale: Locale,
  destination: Destination,
  plans: Plan[],
) {
  const es = locale === "es";
  const name = destination.name[locale];
  const sorted = [...plans].sort((a, b) => a.dataGb - b.dataGb);
  const durations = [...new Set(plans.map((plan) => plan.days))].sort(
    (a, b) => a - b,
  );
  const allowances = [...new Set(sorted.map((plan) => plan.dataGb))].map(
    (gb) => (gb < 1 ? `${Math.round(gb * 1000)} MB` : `${gb} GB`),
  );
  const list = (values: (string | number)[]) =>
    new Intl.ListFormat(es ? "es" : "en", { type: "conjunction" }).format(
      values.map(String),
    );
  const operators = [
    ...new Set(
      plans.flatMap(
        (plan) =>
          plan.details?.networks
            .filter(
              (network) =>
                destination.type === "country" &&
                network.countryCode === destination.code,
            )
            .flatMap((network) =>
              network.operators.map((operator) => operator.name),
            ) ?? [],
      ),
    ),
  ];
  const activationTypes = new Set(
    plans.map((plan) => plan.details?.activation),
  );
  const coverageCounts = plans.map(
    (plan) => new Set(plan.details?.coverage ?? []).size,
  );
  const range = !allowances.length
    ? es
      ? "datos por confirmar"
      : "data to be confirmed"
    : allowances.length === 1
      ? allowances[0]
      : `${allowances[0]} – ${allowances.at(-1)}`;
  const duration = !durations.length
    ? es
      ? "duración por confirmar"
      : "validity to be confirmed"
    : durations.length === 1
      ? `${durations[0]}`
      : `${durations[0]}–${durations.at(-1)}`;
  const starts = {
    network: es
      ? "al conectarse por primera vez a una red compatible"
      : "on the first connection to a supported network",
    installation: es ? "al instalar la eSIM" : "when the eSIM is installed",
    purchase: es ? "al comprar el plan" : "when the plan is purchased",
  };
  const confirmedStarts = [...activationTypes].flatMap((start) =>
    start ? [starts[start]] : [],
  );
  const activation =
    !plans.length || activationTypes.has(undefined)
      ? es
        ? "El inicio de la vigencia no está confirmado para todas las variantes. Revisa este dato en tu plan y consulta al equipo si aparece pendiente."
        : "The validity start is not confirmed for every variant. Check your plan’s details and ask our team if this information is pending."
      : activationTypes.size === 1
        ? es
          ? `En estos planes, la vigencia empieza ${confirmedStarts[0]}. Revisa este dato antes de instalar o comprar para que los días coincidan con tu viaje.`
          : `For these plans, validity starts ${confirmedStarts[0]}. Check this before installing or purchasing so that the validity matches your trip.`
        : es
          ? `Según la variante, la vigencia empieza ${list(confirmedStarts)}. Revisa «Inicio de la vigencia» en el plan que selecciones antes de instalarlo.`
          : `Depending on the variant, validity starts ${list(confirmedStarts)}. Check “When validity starts” on your selected plan before installing.`;
  const selectionSummary = plans.length
    ? es
      ? `Para ${name} hay ${plans.length} ${plans.length === 1 ? "plan de datos fijos" : "planes de datos fijos"}, con opciones de ${list(allowances)}. Las duraciones disponibles son de ${list(durations)} días. Elige la combinación que cubra tu estancia: la bolsa de datos corresponde a toda la vigencia, no a cada día.`
      : `${name} has ${plans.length} fixed-data ${plans.length === 1 ? "plan" : "plans"}, with ${list(allowances)} options. Available validity periods are ${list(durations)} days. Choose a combination that covers your stay: the allowance lasts for the full validity period, rather than resetting each day.`
    : es
      ? `No hay planes publicados para ${name} en este momento. Consulta otros destinos o pregunta al equipo antes de organizar tu conexión.`
      : `There are no published plans for ${name} right now. Explore other destinations or ask our team before planning your connection.`;
  const networkSummary =
    destination.type === "region"
      ? plans.length && coverageCounts.every((count) => count > 0)
        ? es
          ? `Según la variante, los planes incluyen ${Math.min(...coverageCounts) === Math.max(...coverageCounts) ? Math.min(...coverageCounts) : `entre ${Math.min(...coverageCounts)} y ${Math.max(...coverageCounts)}`} países y territorios. Comprueba cada parada en la cobertura del plan: el nombre de la región no garantiza todos sus países.`
          : `Depending on the variant, plans list ${Math.min(...coverageCounts) === Math.max(...coverageCounts) ? Math.min(...coverageCounts) : `between ${Math.min(...coverageCounts)} and ${Math.max(...coverageCounts)}`} countries and territories. Check each stop in the plan coverage: a region’s name does not guarantee every country is included.`
        : es
          ? "Revisa los países y territorios incluidos en cada variante. No des por incluida una parada sólo por el nombre de la región."
          : "Review the countries and territories listed for each variant. A region’s name alone does not guarantee that a stop is covered."
      : operators.length
        ? es
          ? `El catálogo para ${name} incluye ${list(operators)}. La selección de operador y tecnología cambia entre variantes; comprueba la red del plan que elijas. La señal depende del lugar, la red y tu dispositivo.`
          : `The ${name} catalog lists ${list(operators)}. Operators and technologies vary between variants, so check the network for your selected plan. Signal depends on location, network and your device.`
        : es
          ? `Los operadores de ${name} están pendientes de confirmar en esta información del catálogo. Consulta la cobertura de la variante y pregunta al equipo si necesitas comprobar una red concreta.`
          : `Operators for ${name} are not confirmed in this catalog information. Check the variant’s coverage and ask our team if you need a particular network.`;
  const description = !plans.length
    ? es
      ? `Consulta la disponibilidad de eSIM para ${name} y explora otros destinos para tu viaje.`
      : `Check eSIM availability for ${name} and explore other destinations for your trip.`
    : es
      ? `eSIM para ${name}: compara ${plans.length} planes de ${range}, con ${duration} días de vigencia. Consulta redes, cobertura y compatibilidad antes de elegir.`
      : `${name} eSIM: compare ${plans.length} plans with ${range} and ${duration}-day validity. Check networks, coverage and device compatibility before choosing.`;
  const faqs = [
    {
      question: es
        ? `¿Qué planes eSIM hay para ${name}?`
        : `Which eSIM plans are available for ${name}?`,
      answer: !plans.length
        ? selectionSummary
        : es
          ? `Hay ${plans.length} planes de datos fijos, con opciones de ${range} y duraciones de ${duration} días. Filtra por GB o días arriba para ver las combinaciones disponibles. Los datos pertenecen a toda la vigencia, no a cada día.`
          : `There are ${plans.length} fixed-data plans, with ${range} options and ${duration}-day durations. Filter by data or days above to see the available combinations. The allowance covers the full validity period, rather than each day.`,
    },
    {
      question: es
        ? `¿Qué cobertura tiene la eSIM en ${name}?`
        : `What coverage does the eSIM have in ${name}?`,
      answer: networkSummary,
    },
    {
      question: es
        ? "¿Cuándo empieza a contar la duración?"
        : "When does the validity period start?",
      answer: activation,
    },
    {
      question: es
        ? "¿Puedo compartir internet y mantener mi WhatsApp?"
        : "Can I share data and keep my WhatsApp?",
      answer: es
        ? "El proveedor permite compartir datos en dispositivos compatibles; el consumo se descuenta del mismo plan. Puedes mantener tu cuenta de WhatsApp. La eSIM se considera solo de datos salvo que el plan indique expresamente llamadas o SMS."
        : "The provider allows data sharing on compatible devices; usage comes from the same allowance. You can keep your WhatsApp account. Treat the eSIM as data-only unless the plan explicitly includes calls or SMS.",
    },
    {
      question: es
        ? "¿Cómo compruebo si mi teléfono es compatible?"
        : "How do I check whether my phone is compatible?",
      answer: es
        ? "Abre «Verificar compatibilidad» arriba y elige marca y modelo. Comprueba también la variante regional y que el equipo esté liberado. Si el modelo no aparece, confirma con el fabricante antes de continuar."
        : "Open “Check compatibility” above and choose your brand and model. Also check the regional variant and that your device is carrier-unlocked. If your model is missing, confirm with the manufacturer before continuing.",
    },
    {
      question: es
        ? "¿Debo activar la itinerancia de datos?"
        : "Should I enable data roaming?",
      answer: es
        ? "Sí, activa la itinerancia en la eSIM de viaje y selecciónala para los datos móviles. Desactiva la itinerancia y el cambio automático de datos de tu línea habitual para evitar consumos de esa línea. Sigue las instrucciones de instalación específicas del plan, incluido el APN si se solicita."
        : "Yes, enable roaming on your travel eSIM and select it for mobile data. Disable roaming and automatic data switching on your home line to avoid using that line's data. Follow the plan's specific installation instructions, including its APN if requested.",
    },
  ];
  return {
    name,
    range,
    duration,
    description,
    selectionSummary,
    networkSummary,
    activation,
    faqs,
  };
}
