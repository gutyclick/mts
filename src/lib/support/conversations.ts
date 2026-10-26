import { z } from "zod";
export const guestSupportCookie = "mts_support_guest";
export const conversationTopics = [
  "general",
  "installation",
  "connection",
  "plans",
  "orders",
  "compatibility",
] as const;
export type ConversationTopic = (typeof conversationTopics)[number];
export const conversationTopicNames = {
  es: {
    general: "Otra consulta",
    installation: "Instalar mi eSIM",
    connection: "No consigo conectarme",
    plans: "Elegir un plan",
    orders: "Mi pedido o pago",
    compatibility: "Mi teléfono",
  },
  en: {
    general: "Something else",
    installation: "Install my eSIM",
    connection: "I cannot connect",
    plans: "Choose a plan",
    orders: "My order or payment",
    compatibility: "My phone",
  },
};
const conversationOpenings = {
  es: {
    general:
      "Cuéntame qué necesitas resolver con MyTripSim y te ayudo paso a paso.",
    installation:
      "Vamos a instalar tu eSIM. ¿Qué modelo de teléfono tienes? No compartas tu QR ni tus códigos de activación.",
    connection:
      "Vamos a revisar tu conexión. ¿En qué país estás y qué sucede: no aparece ninguna red o tienes señal pero no internet?",
    plans:
      "Te ayudo a elegir tu plan. ¿A qué país o países viajas y cuántos días estarás?",
    orders:
      "Revisemos tu pedido. ¿Qué necesitas resolver con el pago o la entrega de tu eSIM? No compartas datos de tu tarjeta.",
    compatibility:
      "Comprobemos tu teléfono. ¿Cuál es la marca y el modelo exacto, y en qué país lo compraste?",
  },
  en: {
    general:
      "Tell me what you need help with at MyTripSim and we’ll work through it together.",
    installation:
      "Let’s install your eSIM. What phone model do you have? Please don’t share your QR or activation codes.",
    connection:
      "Let’s check your connection. Which country are you in, and do you see no network or have a signal but no internet?",
    plans:
      "Let’s find your plan. Which country or countries are you visiting, and how many days will you stay?",
    orders:
      "Let’s look at your order. What do you need help with: your payment or eSIM delivery? Please don’t share your card details.",
    compatibility:
      "Let’s check your phone. What is its exact brand and model, and which country did you buy it in?",
  },
} satisfies Record<"es" | "en", Record<ConversationTopic, string>>;
export function conversationOpening(locale: "es" | "en", topic?: string) {
  const selected =
    conversationTopics.find((value) => value === topic) ?? "general";
  return conversationOpenings[locale][selected];
}
export const conversationRequest = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("start"),
      requestId: z.uuid(),
      topic: z.enum(conversationTopics),
      locale: z.enum(["es", "en"]),
      language: z
        .enum(["auto", "es", "en", "pt", "fr", "de", "it"])
        .default("auto"),
    })
    .strict(),
  z
    .object({
      action: z.literal("close"),
      threadId: z.uuid(),
      reason: z.enum(["resolved", "inactivity"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("rate"),
      threadId: z.uuid(),
      rating: z.number().int().min(1).max(5),
      comment: z.string().trim().max(600).default(""),
    })
    .strict(),
]);
export function conversationDeadline(updatedAt: string, idleSeconds: number) {
  return new Date(
    new Date(updatedAt).getTime() + idleSeconds * 1000,
  ).toISOString();
}
