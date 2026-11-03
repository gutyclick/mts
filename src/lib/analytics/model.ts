import { z } from "zod";
export const statsPreferenceCookie = "mts_stats_consent";
export const statsSessionCookie = "mts_stats_session";
export const statsVersion = "v1";
export function publicStatsPath(path: string) {
  return (
    /^\/(es|en)(?:\/(?:destinos|destinations|como-funciona|how-it-works|compatibilidad|compatibility|preguntas-frecuentes|faq|terminos|terms|privacidad|privacy|reembolsos|refunds|cookies)(?:\/[-a-z0-9]+)?)?\/?$/.test(
      path,
    ) || destinationFromPath(path) !== null
  );
}
export function analyticsAllowed(
  preference: string | null | undefined,
  dnt: boolean,
  gpc: boolean,
) {
  return preference === "v1.yes" && !dnt && !gpc;
}
export function validAnalyticsToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
export const checkoutEventKinds = [
  "checkout_entry",
  "contact_ready",
  "payment_ready",
  "coupon_attempted",
  "coupon_applied",
  "coupon_rejected",
  "payment_attempt",
  "payment_error",
] as const;
export type CheckoutEventKind = (typeof checkoutEventKinds)[number];
export function checkoutStatsPath(path: string) {
  return /^\/(?:es\/compra|en\/checkout)\/?$/.test(path);
}
const destinationEventSchema = z
  .object({
    kind: z.enum(["destination_view", "add_to_cart"]),
    destination: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9-]+$/),
  })
  .strict();
export const clientEventSchema = z.union([
  destinationEventSchema,
  z.object({ kind: z.enum(checkoutEventKinds) }).strict(),
]);
export function destinationFromPath(path: string) {
  const match = /^\/(?:es|en)\/esim\/([a-z0-9-]{1,80})\/?$/.exec(path);
  return match && match[1] !== "access" ? match[1] : null;
}
