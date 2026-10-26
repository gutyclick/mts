export type FAQVote = "helpful" | "more-help";
export const feedbackKey = (id: string) => `mytripsim:faq-feedback:v1:${id}`;
export function parseFAQVote(value: unknown): FAQVote | null {
  return value === "helpful" || value === "more-help" ? value : null;
}
export const feedbackCopy = {
  en: {
    prompt: "Did this answer help?",
    yes: "Yes, it helped",
    more: "I need more help",
    thanks: "Glad that helped. Have a great trip!",
    local: "Your choice stays in this browser; it is not sent to our team.",
    temporary:
      "Your choice is kept for this visit. Your browser could not save it.",
    title: "Let’s find your next step",
    description:
      "Try these related answers or create a ticket for our team. Your feedback alone does not send a support request.",
    related: "You may also find these useful",
    copy: "Copy my question",
    copied:
      "Question copied. You can add your device, destination and error message before sharing it.",
    copyFailed: "Copy is unavailable. Select and copy the question below.",
    summary: "Your question",
    device: "Device model",
    destination: "Destination and plan",
    issue: "What happened / error message",
    reference: "Help article",
    privacy: "Keep QR codes, activation credentials and passwords private.",
  },
  es: {
    prompt: "¿Te ayudó esta respuesta?",
    yes: "Sí, me ayudó",
    more: "Necesito más ayuda",
    thanks: "¡Qué bueno! Una duda menos para tu viaje.",
    local: "Tu elección queda en este navegador; no se envía a nuestro equipo.",
    temporary:
      "Tu elección se mantiene durante esta visita. Tu navegador no pudo guardarla.",
    title: "Busquemos tu siguiente paso",
    description:
      "Consulta estas respuestas o crea un ticket para nuestro equipo. Tu valoración por sí sola no envía una solicitud de soporte.",
    related: "Estas respuestas también pueden ayudarte",
    copy: "Copiar mi consulta",
    copied:
      "Consulta copiada. Puedes añadir tu equipo, destino y mensaje de error antes de compartirla.",
    copyFailed:
      "No se pudo copiar automáticamente. Selecciona y copia la consulta de abajo.",
    summary: "Tu consulta",
    device: "Modelo del teléfono",
    destination: "Destino y plan",
    issue: "Qué ocurrió / mensaje de error",
    reference: "Artículo de ayuda",
    privacy:
      "Mantén privados tus QR, credenciales de activación y contraseñas.",
  },
};
