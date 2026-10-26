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
