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
  const allowances = [...new Set(sorted.map((plan) => plan.allowance))];
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
  const range =
    allowances.length === 1
      ? allowances[0]
      : `${allowances[0]} – ${allowances.at(-1)}`;
  const duration =
    durations.length === 1
      ? `${durations[0]}`
      : `${durations[0]}–${durations.at(-1)}`;
  const activation =
    activationTypes.size === 1 && activationTypes.has("network")
      ? es
        ? "La vigencia empieza al conectarse por primera vez a una red compatible en destino. Puedes consultar este dato en la ficha antes de instalarla."
        : "Validity starts on the first connection to a supported network at your destination. Check this in the plan details before installing."
      : es
        ? "El inicio de la vigencia cambia según la variante: puede ser al conectarse a la red, al instalar o tras la compra. Revisa «Inicio de la vigencia» en tu plan antes de instalarlo."
        : "The validity start depends on the variant: network connection, installation or purchase. Check “When validity starts” on your selected plan before installing.";
  const description = es
    ? `eSIM para ${name}: ${plans.length} planes de datos fijos, de ${range} y ${duration} días. Consulta operadores, cobertura, activación y compatibilidad.`
    : `${name} eSIM: ${plans.length} fixed-data plans, ${range} and ${duration} days. Explore operators, coverage, activation and device compatibility.`;
  const faqs = [
    {
      question: es
        ? `¿Qué planes eSIM hay para ${name}?`
        : `Which eSIM plans are available for ${name}?`,
      answer: es
        ? `Hay ${plans.length} planes de datos fijos, con opciones de ${range} y duraciones de ${duration} días. Filtra por GB o días arriba para ver las combinaciones disponibles. Los datos pertenecen a toda la vigencia, no a cada día.`
        : `There are ${plans.length} fixed-data plans, with ${range} options and ${duration}-day durations. Filter by data or days above to see the available combinations. The allowance covers the full validity period, rather than each day.`,
    },
    {
      question: es
        ? `¿Qué cobertura tiene la eSIM en ${name}?`
        : `What coverage does the eSIM have in ${name}?`,
      answer:
        destination.type === "region"
          ? es
            ? "Los países y operadores pueden cambiar entre variantes. Selecciona un plan y abre «Países y territorios incluidos» para comprobar cada parada de tu viaje; el nombre de la región no garantiza todos sus países."
            : "Countries and operators can vary between variants. Select a plan and open “Included countries and territories” to check each stop on your trip; a region's name does not guarantee every country is included."
          : operators.length
            ? es
              ? `El catálogo del proveedor incluye ${operators.join(", ")}. No todas las variantes incluyen los mismos operadores o tecnologías: consulta la tabla del plan seleccionado. La señal depende de la ubicación, la red y el dispositivo.`
              : `The provider's catalog includes ${operators.join(", ")}. Variants may have different operators or technologies: check the selected plan's table. Signal depends on location, network and device.`
            : es
              ? "Consulta las redes y tecnologías en la ficha del plan seleccionado. La señal depende del lugar, la red y tu equipo; no se garantiza una velocidad concreta."
              : "Check networks and technologies in the selected plan details. Signal depends on location, network and device; a particular speed is not guaranteed.",
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
  return { name, range, duration, description, faqs };
}
