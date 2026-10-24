export interface FAQQuestion {
  id: string;
  question: string;
  answer: string;
  steps?: string[];
  note?: string;
  links?: { label: string; href: string }[];
  related?: string[];
}
export interface FAQCategory {
  id: string;
  title: string;
  description: string;
  questions: FAQQuestion[];
}
export interface HelpContent {
  title: string;
  description: string;
  search: string;
  all: string;
  questions: string;
  empty: string;
  reset: string;
  sources: string;
  sourceDescription: string;
  categories: FAQCategory[];
}

// Product policies supplied by our eSIM provider; device behavior checked against manufacturer guidance.
export const helpContent: Record<"en" | "es", HelpContent> = {
  en: {
    title: "A little guidance. A smoother trip.",
    description:
      "Find answers about eSIMs, choosing a plan, installation and staying connected.",
    search: "Search questions",
    all: "All topics",
    questions: "answers",
    empty: "No answers match your search.",
    reset: "Clear search",
    sources: "Check your phone’s official guidance",
    sourceDescription:
      "Compatibility and settings vary by device, country and carrier. Consult the manufacturer for your exact model.",
    categories: [
      {
        id: "basics",
        title: "Getting started",
        description: "Understand eSIMs and choose a destination.",
        questions: [
          {
            id: "what-is-esim",
            question: "What is an eSIM?",
            answer:
              "An eSIM is a digital SIM profile installed on a compatible device. A travel eSIM can provide mobile data without replacing your physical SIM.",
          },
          {
            id: "country-or-region",
            question:
              "What is the difference between a country and a regional plan?",
            answer:
              "Country plans are listed under one destination. Regional plans are listed separately. A regional name does not confirm every included country: check the provider’s complete coverage before choosing a plan.",
          },
          {
            id: "purchase-availability",
            question: "Can I purchase a plan here?",
            answer:
              "For now, MyTripSim lets you explore and compare the available catalog. Purchases, payments and eSIM delivery are not available yet.",
          },
          {
            id: "similar-plan-names",
            question: "Why do some plans have similar names?",
            answer:
              "The catalog retains the original names of the fixed data plans we offer. Compare the total data allowance and duration; similar names may represent different products.",
          },
          {
            id: "phone-number-sms",
            question: "Does my eSIM include a phone number, calls or SMS?",
            answer:
              "Generally, these travel eSIMs are data-only. A phone number, call minutes or SMS are included only when explicitly stated in the plan. If the plan does not mention them, treat it as data-only. Internet calling and messaging apps can use its data connection.",
            related: ["dual-sim", "wifi-calling"],
          },
        ],
      },
      {
        id: "compatibility",
        title: "Phones & compatibility",
        description: "Prepare the right device before traveling.",
        questions: [
          {
            id: "device-compatibility",
            question: "How do I know if my phone supports eSIM?",
            answer:
              "Check the exact model and regional version in your manufacturer’s documentation. eSIM support can vary within the same phone family. The device must also permit the intended carrier’s eSIM.",
          },
          {
            id: "carrier-lock",
            question: "What does carrier unlocked mean?",
            answer:
              "A carrier lock can restrict your device to one operator. Ask your current carrier whether your phone is unlocked and eligible for another operator’s eSIM.",
          },
          {
            id: "dual-sim",
            question: "Can I use my home SIM and travel eSIM together?",
            answer:
              "Yes, if your phone supports Dual SIM. Keep your home line for calls and messages and select the travel eSIM for mobile data.",
            steps: [
              "Label your lines, for example Home and MyTripSim.",
              "Select MyTripSim for mobile data and choose your preferred voice line.",
              "Turn off data roaming on your home line and review automatic mobile data switching to avoid unintended use.",
            ],
            note: "Calls and messages on your home line still depend on your home carrier and may incur charges.",
          },
          {
            id: "esim-transfer",
            question: "Can I move the eSIM to another phone?",
            answer:
              "For the travel eSIMs supplied by our provider, the QR code is linked to the first device used for installation. It cannot be transferred to another phone. Choose the correct device before installing and do not delete the profile to try moving it.",
          },
          {
            id: "multiple-esims",
            question: "Can I keep eSIMs from different providers on my phone?",
            answer:
              "Yes, on a compatible device. You may store several profiles, but the number stored and the number active at once depend on the exact model, regional version and software. Check your manufacturer's specifications rather than assuming a fixed number for all iPhones or Android phones.",
            steps: [
              "Give each profile a recognizable name, such as Home, Japan or Europe.",
              "Keep the profiles you are not using inactive.",
              "Select the intended line for mobile data; storing a profile does not mean it is active.",
            ],
          },
        ],
      },
      {
        id: "installation",
        title: "Installation & activation",
        description: "From adding a profile to your first connection.",
        questions: [
          {
            id: "install-esim",
            question: "How is a travel eSIM installed?",
            answer:
              "Installation may use a QR code or manual settings supplied by the provider. Follow the instructions for your exact phone and product. MyTripSim does not currently issue activation codes.",
          },
          {
            id: "internet-for-installation",
            question: "Do I need internet to install an eSIM?",
            answer:
              "Use a reliable internet connection when downloading the profile. Keep the installation instructions accessible on another screen or use the manufacturer’s supported installation method.",
          },
          {
            id: "activation-start",
            question: "When does my plan start?",
            answer:
              "Activation rules vary: a plan may start at installation, at first connection to a supported network, or at another specified event. Confirm this before installing it ahead of your trip.",
          },
          {
            id: "delete-profile",
            question: "Should I delete an eSIM if installation fails?",
            answer:
              "Keep the profile while checking settings and provider guidance. Deleting it may prevent reuse. Contact the provider before deleting or reinstalling an activation profile.",
          },
          {
            id: "qr-code-device",
            question: "Can several phones scan the same QR code?",
            answer:
              "No. Our provider's activation QR code is for one installation on a single device. It is tied to that device and cannot be shared or later transferred to a different phone.",
            note: "Keep your QR code private. Do not delete an installed profile to try reusing the code.",
            related: ["esim-transfer", "delete-profile"],
          },
        ],
      },
      {
        id: "data",
        title: "Data & plan types",
        description: "Understand total data allowances and validity.",
        questions: [
          {
            id: "fixed-data",
            question: "What is a fixed data plan?",
            answer:
              "A fixed plan lists a total allowance for its stated duration. The catalog preserves the original MB or GB label and the number of days provided in the plan list.",
          },
          {
            id: "daily-fup",
            question: "Do you offer daily data plans?",
            answer:
              "No. Our catalog only includes fixed data plans: a total allowance for the stated duration, without a daily data reset. Daily data packages are not available in our catalog.",
          },
          {
            id: "mb-or-gb",
            question: "Why do some plans show MB instead of GB?",
            answer:
              "Smaller allowances are kept in their original units, such as 100MB or 500MB. Use the data filter to compare the allowance and read the plan name for additional context.",
          },
          {
            id: "hotspot",
            question: "Can I share data with a hotspot?",
            answer:
              "Yes. Our provider confirms hotspot, tethering and data sharing are enabled on its eSIMs, provided your device supports the feature. Shared data uses your plan's allowance and remains subject to its fair use policy.",
            steps: [
              "Select your travel eSIM for mobile data.",
              "Turn on Personal Hotspot on iPhone, or Hotspot & tethering on Android.",
              "Set a Wi-Fi password and connect your other device. Turn sharing off when you finish.",
            ],
            links: [
              {
                label: "iPhone hotspot guide",
                href: "https://support.apple.com/en-us/111785",
              },
              {
                label: "Android hotspot guide",
                href: "https://support.google.com/android/answer/9059108?hl=en",
              },
            ],
            related: ["apn-settings", "data-roaming"],
          },
        ],
      },
      {
        id: "travel",
        title: "During your trip",
        description: "Keep your number and prepare for more destinations.",
        questions: [
          {
            id: "whatsapp",
            question: "Can I keep using WhatsApp?",
            answer:
              "An existing WhatsApp account can generally use an internet connection from another SIM without changing the account’s registered number. Keep access to your number if verification is required.",
          },
          {
            id: "home-number",
            question: "Will my normal number still receive calls?",
            answer:
              "This depends on your phone’s dual SIM support, line settings and home carrier. Your carrier may charge for calls, messages or roaming. Review those settings before traveling.",
          },
          {
            id: "cross-border",
            question: "Will my plan work in another country?",
            answer:
              "Only use a plan where its provider confirms coverage. Country and regional listings do not establish additional destinations, supported networks or cross-border availability.",
          },
          {
            id: "before-departure",
            question: "What should I check before departure?",
            answer:
              "Confirm device compatibility, carrier unlock status, coverage, data allowance, duration and activation rules. Save the provider’s instructions and arrange internet access for installation.",
          },
          {
            id: "wifi-calling",
            question: "Can Wi-Fi Calling keep my home number reachable?",
            answer:
              "It may, if your home carrier and phone support Wi-Fi Calling and it is enabled for your home line. Some supported Dual SIM combinations can use the other SIM's data connection for calls, but this is not guaranteed on every device or carrier.",
            steps: [
              "Before traveling, check availability, overseas restrictions and charges with your home carrier.",
              "Enable Wi-Fi Calling for your home line if supported.",
              "Keep home-line data roaming off. Confirm the line and connection shown before calling.",
            ],
            note: "A travel data eSIM does not itself add a phone number or guarantee free calls on your home line.",
            links: [
              {
                label: "Apple Dual SIM guidance",
                href: "https://support.apple.com/en-us/109317",
              },
            ],
            related: ["dual-sim", "phone-number-sms"],
          },
        ],
      },
      {
        id: "connection",
        title: "Connection & troubleshooting",
        description: "Practical checks when you need a hand.",
        questions: [
          {
            id: "no-internet",
            question: "I have signal but no internet. What can I check?",
            answer:
              "Confirm the correct SIM is selected for data, that the plan is active and valid at your location, and that data remains. Follow the provider’s network and APN instructions. Restart the device if advised.",
            steps: [
              "Check that the travel eSIM is selected for mobile data and its data roaming is on.",
              "Check your destination, activation status, validity and remaining allowance.",
              "Review the APN instructions for your eSIM; if needed, use a reliable Wi-Fi connection while troubleshooting.",
            ],
            related: ["data-roaming", "apn-settings", "activation-start"],
          },
          {
            id: "data-roaming",
            question: "Should data roaming be enabled?",
            answer:
              "Yes. Our provider requires data roaming to be ON for the travel eSIM. Keep data roaming OFF on your home SIM to avoid unintended charges.",
            steps: [
              "iPhone: Settings → Cellular / Mobile Data → select the travel eSIM → Data Roaming ON.",
              "Android: Settings → Network & internet / Connections → SIMs / Mobile networks → select the travel eSIM → Roaming ON.",
              "Select the travel eSIM for mobile data. Separately check that roaming is OFF on your home line.",
            ],
            note: "Menu names vary by phone and operating system. Roaming is a per-line setting: check the selected SIM before changing it.",
            related: ["dual-sim", "no-internet", "apn-settings"],
          },
          {
            id: "remaining-data",
            question: "Where can I check remaining data?",
            answer:
              "Use the provider’s supported usage tools. Device estimates can differ from provider measurements. MyTripSim does not currently offer a live data balance or account dashboard.",
          },
          {
            id: "troubleshooting-details",
            question: "What information helps troubleshoot a problem?",
            answer:
              "Note the exact device model, destination, plan name and error message. Use the provider’s official support channel and keep QR codes, activation credentials and personal information private.",
          },
          {
            id: "apn-settings",
            question: "Which APN should I use for internet and hotspot?",
            answer:
              "An APN is the network setting used for mobile data. Our provider says iPhone APNs are normally preconfigured, with a Japan exception that uses vmobile.jp. On Android, use the APN and any credentials supplied with your exact eSIM.",
            steps: [
              "Open the mobile data or access point settings for the travel eSIM, if your phone allows editing.",
              "For the provider's Japan iPhone configuration, enter vmobile.jp where its installation instructions specify.",
              "On Android, copy the APN, username and password only from your eSIM instructions. Leave fields unchanged unless instructed.",
            ],
            note: "Do not use vmobile.jp for other destinations or guess credentials. Follow your exact product's instructions if they differ, and never share activation details publicly.",
            related: ["hotspot", "no-internet"],
          },
        ],
      },
    ],
  },
  es: {
    title: "Un poco de ayuda. Un viaje más tranquilo.",
    description:
      "Resuelve tus dudas sobre eSIM, planes, instalación y conexión durante tu viaje.",
    search: "Buscar preguntas",
    all: "Todos los temas",
    questions: "respuestas",
    empty: "No encontramos respuestas para esa búsqueda.",
    reset: "Limpiar búsqueda",
    sources: "Consulta la guía oficial de tu teléfono",
    sourceDescription:
      "La compatibilidad y los ajustes varían según dispositivo, país y operador. Consulta las instrucciones del fabricante para tu modelo exacto.",
    categories: [
      {
        id: "basics",
        title: "Primeros pasos",
        description: "Conoce las eSIM y elige tu destino.",
        questions: [
          {
            id: "what-is-esim",
            question: "¿Qué es una eSIM?",
            answer:
              "Es un perfil SIM digital que se instala en un dispositivo compatible. Una eSIM de viaje puede darte datos móviles sin reemplazar tu SIM física.",
          },
          {
            id: "country-or-region",
            question:
              "¿Qué diferencia hay entre un plan de país y uno regional?",
            answer:
              "Los planes de país aparecen bajo un destino. Los regionales tienen su propio catálogo. El nombre de una región no confirma todos los países incluidos: revisa la cobertura completa del proveedor antes de elegir.",
          },
          {
            id: "purchase-availability",
            question: "¿Ya puedo comprar un plan aquí?",
            answer:
              "Por ahora puedes explorar y comparar el catálogo disponible. Las compras, los pagos y la entrega de eSIM todavía no están habilitados.",
          },
          {
            id: "similar-plan-names",
            question: "¿Por qué hay planes con nombres parecidos?",
            answer:
              "Conservamos los nombres originales de los planes de datos fijos que ofrecemos. Compara los datos totales y la duración; nombres similares pueden corresponder a productos diferentes.",
          },
          {
            id: "phone-number-sms",
            question: "¿Mi eSIM incluye número de teléfono, llamadas o SMS?",
            answer:
              "Generalmente estas eSIM de viaje son solo de datos. Solo incluyen número, minutos o SMS si el plan lo indica expresamente. Si no los menciona, considéralo un plan de datos. Puedes usar aplicaciones de llamadas y mensajes por internet con esa conexión.",
            related: ["dual-sim", "wifi-calling"],
          },
        ],
      },
      {
        id: "compatibility",
        title: "Teléfonos y compatibilidad",
        description: "Prepara tu dispositivo antes de viajar.",
        questions: [
          {
            id: "device-compatibility",
            question: "¿Cómo sé si mi teléfono admite eSIM?",
            answer:
              "Consulta el modelo exacto y su versión regional en la documentación del fabricante. El soporte puede variar dentro de una misma familia de teléfonos. Tu dispositivo también debe permitir la eSIM del operador que utilizarás.",
          },
          {
            id: "carrier-lock",
            question: "¿Qué significa que el teléfono esté liberado?",
            answer:
              "Un bloqueo de operador puede limitar el teléfono a una sola compañía. Consulta con tu operador si está liberado y permite instalar una eSIM de otra compañía.",
          },
          {
            id: "dual-sim",
            question:
              "¿Puedo usar mi SIM habitual y la eSIM de viaje a la vez?",
            answer:
              "Sí, si tu teléfono admite dual SIM. Puedes mantener tu línea habitual para llamadas y mensajes y seleccionar la eSIM de viaje para los datos móviles.",
            steps: [
              "Pon nombres a tus líneas, por ejemplo Habitual y MyTripSim.",
              "Selecciona MyTripSim para datos móviles y elige tu línea predeterminada para llamadas.",
              "Desactiva el roaming de datos de tu línea habitual y revisa el cambio automático de datos entre líneas para evitar usos no deseados.",
            ],
            note: "Las llamadas y los mensajes de tu línea habitual dependen de tu operador y pueden generar cargos.",
          },
          {
            id: "esim-transfer",
            question: "¿Puedo pasar mi eSIM a otro teléfono?",
            answer:
              "En las eSIM de viaje de nuestro proveedor, el QR queda vinculado al primer dispositivo utilizado para instalarlo. No puede transferirse a otro teléfono. Elige el equipo correcto antes de instalar y no borres el perfil para intentar moverlo.",
          },
          {
            id: "multiple-esims",
            question:
              "¿Puedo guardar eSIM de varios proveedores en mi teléfono?",
            answer:
              "Sí, en un dispositivo compatible. Puedes almacenar varios perfiles, pero la cantidad guardada y las líneas activas al mismo tiempo dependen del modelo exacto, su versión regional y el software. Consulta al fabricante; no hay una cifra universal para todos los iPhone o Android.",
            steps: [
              "Asigna un nombre claro a cada perfil, como Habitual, Japón o Europa.",
              "Mantén inactivos los perfiles que no estés usando.",
              "Selecciona la línea correcta para datos; guardar un perfil no significa que esté activo.",
            ],
          },
        ],
      },
      {
        id: "installation",
        title: "Instalación y activación",
        description: "Desde añadir el perfil hasta tu primera conexión.",
        questions: [
          {
            id: "install-esim",
            question: "¿Cómo se instala una eSIM de viaje?",
            answer:
              "Puede instalarse con un QR o con los ajustes manuales que entregue el proveedor. Sigue las instrucciones de tu teléfono y producto. MyTripSim todavía no emite códigos de activación.",
          },
          {
            id: "internet-for-installation",
            question: "¿Necesito internet para instalarla?",
            answer:
              "Utiliza una conexión estable al descargar el perfil. Ten las instrucciones disponibles en otra pantalla o utiliza el método de instalación que admita tu fabricante.",
          },
          {
            id: "activation-start",
            question: "¿Cuándo comienza la duración del plan?",
            answer:
              "Depende del producto: puede empezar al instalarse, al conectarse por primera vez a una red compatible o en otro momento indicado. Confírmalo antes de instalarlo con anticipación.",
          },
          {
            id: "delete-profile",
            question: "¿Debo borrar la eSIM si falla la instalación?",
            answer:
              "Conserva el perfil mientras revisas los ajustes y las instrucciones. Eliminarlo podría impedir su reutilización. Consulta al proveedor antes de borrarlo o reinstalarlo.",
          },
          {
            id: "qr-code-device",
            question: "¿Pueden varios teléfonos escanear el mismo QR?",
            answer:
              "No. El QR de activación de nuestro proveedor permite una instalación en un solo dispositivo. Queda vinculado a ese equipo y no puede compartirse ni transferirse después a otro teléfono.",
            note: "Mantén tu QR privado. No borres un perfil instalado para intentar reutilizar el código.",
            related: ["esim-transfer", "delete-profile"],
          },
        ],
      },
      {
        id: "data",
        title: "Datos y tipos de plan",
        description: "Entiende los datos incluidos y la duración.",
        questions: [
          {
            id: "fixed-data",
            question: "¿Qué es un plan de datos fijos?",
            answer:
              "Indica una cantidad total de datos para su duración. El catálogo conserva la unidad original, MB o GB, y los días indicados en la lista de planes.",
          },
          {
            id: "daily-fup",
            question: "¿Ofrecen planes de datos diarios?",
            answer:
              "No. Nuestro catálogo solo incluye planes de datos fijos: una cantidad total para la duración indicada, sin renovación diaria de datos. Los paquetes de datos diarios no están disponibles en nuestro catálogo.",
          },
          {
            id: "mb-or-gb",
            question: "¿Por qué algunos planes muestran MB?",
            answer:
              "Las cantidades pequeñas mantienen su unidad original, como 100MB o 500MB. Usa el filtro de datos y consulta el nombre del plan para comparar sus características.",
          },
          {
            id: "hotspot",
            question: "¿Puedo compartir internet con hotspot?",
            answer:
              "Sí. Nuestro proveedor confirma que sus eSIM permiten compartir datos mediante hotspot o tethering cuando tu teléfono admite esta función. Los dispositivos conectados consumen los datos de tu plan y están sujetos a su política de uso justo.",
            steps: [
              "Selecciona la eSIM de viaje para los datos móviles.",
              "Activa Compartir internet en iPhone o Zona Wi-Fi / Compartir conexión en Android.",
              "Configura una contraseña Wi-Fi y conecta el otro dispositivo. Desactiva la función al terminar.",
            ],
            links: [
              {
                label: "Guía de hotspot para iPhone",
                href: "https://support.apple.com/es-es/111785",
              },
              {
                label: "Guía de hotspot para Android",
                href: "https://support.google.com/android/answer/9059108?hl=es",
              },
            ],
            related: ["apn-settings", "data-roaming"],
          },
        ],
      },
      {
        id: "travel",
        title: "Durante tu viaje",
        description: "Mantén tu número y prepara tu siguiente parada.",
        questions: [
          {
            id: "whatsapp",
            question: "¿Puedo seguir usando WhatsApp?",
            answer:
              "Una cuenta existente de WhatsApp generalmente puede usar internet de otra SIM sin cambiar su número registrado. Mantén acceso a tu número si la aplicación solicita verificación.",
          },
          {
            id: "home-number",
            question: "¿Mi número habitual seguirá recibiendo llamadas?",
            answer:
              "Depende del soporte dual SIM, los ajustes y tu operador habitual. Podrían aplicarse cargos por llamadas, mensajes o roaming. Revisa esos ajustes antes de viajar.",
          },
          {
            id: "cross-border",
            question: "¿El plan funcionará en otro país?",
            answer:
              "Solo donde el proveedor confirme cobertura. El listado de países y regiones no confirma destinos adicionales, redes disponibles ni cobertura al cruzar fronteras.",
          },
          {
            id: "before-departure",
            question: "¿Qué reviso antes de salir?",
            answer:
              "Confirma compatibilidad, liberación del equipo, cobertura, datos, duración y reglas de activación. Guarda las instrucciones del proveedor y prepara una conexión para instalar el perfil.",
          },
          {
            id: "wifi-calling",
            question:
              "¿Las llamadas por Wi-Fi mantienen disponible mi número habitual?",
            answer:
              "Pueden hacerlo si tu operador habitual y tu teléfono admiten Wi-Fi Calling y lo activas en esa línea. Algunas combinaciones dual SIM también permiten usar los datos de la otra SIM para llamadas, pero no está garantizado en todos los equipos u operadores.",
            steps: [
              "Antes de viajar, consulta disponibilidad, restricciones en el extranjero y tarifas con tu operador habitual.",
              "Activa Llamadas por Wi-Fi en tu línea habitual si está disponible.",
              "Mantén desactivado el roaming de datos de tu línea habitual y comprueba la línea y conexión antes de llamar.",
            ],
            note: "La eSIM de datos no añade por sí misma un número ni garantiza llamadas gratuitas con tu línea habitual.",
            links: [
              {
                label: "Guía de Apple sobre dual SIM",
                href: "https://support.apple.com/es-es/109317",
              },
            ],
            related: ["dual-sim", "phone-number-sms"],
          },
        ],
      },
      {
        id: "connection",
        title: "Conexión y soluciones",
        description: "Comprobaciones prácticas cuando necesitas ayuda.",
        questions: [
          {
            id: "no-internet",
            question: "Tengo señal, pero no internet. ¿Qué reviso?",
            answer:
              "Comprueba que seleccionaste la SIM correcta para datos, que el plan está activo y vigente en tu ubicación y que quedan datos. Sigue las instrucciones de red y APN del proveedor. Reinicia el equipo si así lo indican.",
            steps: [
              "Comprueba que la eSIM de viaje esté seleccionada para datos y tenga el roaming de datos activado.",
              "Revisa destino, activación, vigencia y datos restantes.",
              "Consulta las instrucciones de APN de tu eSIM; utiliza una conexión Wi-Fi estable mientras haces las comprobaciones si la necesitas.",
            ],
            related: ["data-roaming", "apn-settings", "activation-start"],
          },
          {
            id: "data-roaming",
            question: "¿Debo activar el roaming de datos?",
            answer:
              "Sí. Nuestro proveedor requiere activar el roaming de datos en la eSIM de viaje. Mantén el roaming de datos desactivado en tu SIM habitual para evitar cargos no deseados.",
            steps: [
              "iPhone: Ajustes → Datos móviles / Red celular → selecciona la eSIM de viaje → activa Itinerancia de datos.",
              "Android: Ajustes → Redes e internet / Conexiones → SIM / Redes móviles → selecciona la eSIM de viaje → activa Roaming.",
              "Selecciona la eSIM de viaje para datos móviles. Revisa por separado que el roaming esté desactivado en tu línea habitual.",
            ],
            note: "Los nombres del menú varían según el equipo y el sistema. El roaming se configura por línea: comprueba qué SIM estás editando.",
            related: ["dual-sim", "no-internet", "apn-settings"],
          },
          {
            id: "remaining-data",
            question: "¿Dónde consulto los datos restantes?",
            answer:
              "Utiliza las herramientas del proveedor. Las estimaciones del teléfono pueden diferir de su medición. MyTripSim todavía no ofrece un saldo de datos en tiempo real ni un panel de cuenta.",
          },
          {
            id: "troubleshooting-details",
            question: "¿Qué información ayuda a resolver un problema?",
            answer:
              "Anota el modelo exacto, destino, nombre del plan y mensaje de error. Utiliza el soporte oficial del proveedor y mantén privados los QR, las credenciales de activación y tus datos personales.",
          },
          {
            id: "apn-settings",
            question: "¿Qué APN utilizo para internet y para compartir datos?",
            answer:
              "El APN es un ajuste de red para la conexión de datos. Nuestro proveedor indica que en iPhone suele venir preconfigurado, con una excepción para Japón que utiliza vmobile.jp. En Android, utiliza el APN y las credenciales entregadas con tu eSIM concreta.",
            steps: [
              "Abre los ajustes de datos o puntos de acceso de la eSIM de viaje, si el teléfono permite editarlos.",
              "Para la configuración de Japón en iPhone de este proveedor, escribe vmobile.jp donde lo indiquen las instrucciones de instalación.",
              "En Android, copia APN, usuario y contraseña únicamente de las instrucciones de tu eSIM. No cambies otros campos sin indicación.",
            ],
            note: "No uses vmobile.jp para otros destinos ni inventes credenciales. Si las instrucciones de tu producto difieren, sigue esas instrucciones. Nunca compartas datos de activación públicamente.",
            related: ["hotspot", "no-internet"],
          },
        ],
      },
    ],
  },
};
