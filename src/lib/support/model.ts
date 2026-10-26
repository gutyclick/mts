import { z } from "zod";
import { helpContent } from "../help-content.ts";
import { faqQuestionPath } from "../faq-links.ts";
export const languageSchema = z.enum([
  "auto",
  "es",
  "en",
  "pt",
  "fr",
  "de",
  "it",
]);
export const chatRequest = z
  .object({
    requestId: z.uuid(),
    threadId: z.uuid().optional(),
    message: z.string().trim().min(1).max(3000),
    language: languageSchema.default("auto"),
    locale: z.enum(["es", "en"]),
    orderId: z.uuid().optional(),
    history: z
      .array(
        z.object({
          role: z.enum(["user", "assistant"]),
          body: z.string().max(3000),
        }),
      )
      .max(6)
      .default([]),
  })
  .strict();
export function redactSupportText(value: string) {
  return value
    .replace(/LPA:\d\$[^\s]+/gi, "[código de instalación oculto]")
    .replace(
      /\b(?:sk-(?:proj-)?|sb_secret_|re_)[a-z0-9_-]{16,}/gi,
      "[clave oculta]",
    )
    .replace(
      /\b(?:(?:sk|rk)_(?:test|live)_|whsec_)[a-z0-9]{16,}/gi,
      "[clave oculta]",
    )
    .replace(
      /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g,
      "[token oculto]",
    )
    .replace(/\b(?:\d[ -]?){12,22}\b/g, "[número privado oculto]")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");
}
export function supportKnowledge() {
  return helpContent.en.categories.flatMap((c) =>
    c.questions.map((q) => ({
      id: q.id,
      topic: c.title,
      question: q.question,
      answer: [q.answer, ...(q.steps ?? []), q.note ?? ""].join("\n"),
    })),
  );
}
export function visibleReferences(ids: string[], locale: "es" | "en") {
  const questions = helpContent[locale].categories.flatMap((c) => c.questions);
  return [...new Set(ids)].slice(0, 4).flatMap((id) => {
    const q = questions.find((q) => q.id === id);
    return q
      ? [{ id, title: q.question, href: faqQuestionPath(locale, id) }]
      : [];
  });
}
export const referenceSchema = z.object({
  id: z.string().max(80),
  title: z.string().max(300),
  href: z.string().regex(/^\/(?:es\/preguntas-frecuentes|en\/faq)\/[^\s]*$/),
});
export const supportMessageSchema = z.object({
  id: z.uuid(),
  thread_id: z.uuid(),
  author: z.enum(["user", "assistant", "agent", "system"]),
  body: z.string(),
  citations: z.array(referenceSchema).default([]),
  created_at: z.string(),
});
export type SupportMessage = z.infer<typeof supportMessageSchema>;
export const supportThreadSchema = z.object({
  id: z.uuid(),
  subject: z.string(),
  status: z.enum(["chat", "open", "waiting_customer", "resolved"]),
  language: z.string(),
  order_id: z.uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  escalated_at: z.string().nullable(),
  customer_email: z.string().nullable().optional(),
  notification_status: z.string().nullable().optional(),
  topic: z.string().optional(),
  closed_at: z.string().nullable().optional(),
  close_reason: z.enum(["resolved", "inactivity"]).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  rating_comment: z.string().nullable().optional(),
  rated_at: z.string().nullable().optional(),
});
export type SupportThread = z.infer<typeof supportThreadSchema>;
export const ticketRequest = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("create"),
      requestId: z.uuid(),
      threadId: z.uuid().optional(),
      subject: z.string().trim().min(3).max(120),
      body: z.string().trim().min(3).max(4000),
      language: languageSchema.default("auto"),
      orderId: z.uuid().optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("reply"),
      requestId: z.uuid(),
      threadId: z.uuid(),
      body: z.string().trim().min(1).max(4000),
    })
    .strict(),
  z.object({ action: z.literal("resolve"), threadId: z.uuid() }).strict(),
]);
export function ticketReference(id: string) {
  return `MTS-${id.slice(0, 8).toUpperCase()}`;
}
