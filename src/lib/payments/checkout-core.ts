import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { cartSchema } from "../cart.ts";
import { legalVersion } from "../legal-version.ts";
import { currencyCode, currencies } from "../currency.ts";

export const checkoutRequestSchema = z
  .object({
    attemptId: z.uuid(),
    locale: z.enum(["es", "en"]),
    currency: z.enum(currencies.map((c) => c.code)).default("USD"),
    fxQuoteId: z.uuid().nullable().default(null),
    expectedPaymentTotal: z.number().int().min(1).max(99999999).optional(),
    email: z.email().max(254),
    differentRecipient: z.boolean().default(false),
    recipientEmail: z.email().max(254).optional(),
    marketingOptIn: z.boolean().default(false),
    holdPolicy: z.literal("leave-v1").optional(),
    lines: cartSchema.refine((lines) => lines.length > 0),
    expectedTotal: z.number().int().min(1).max(99999999),
    compatible: z.literal(true),
    terms: z.literal(true),
    legalVersion: z.literal(legalVersion),
  })
  .strict()
  .refine((body) => !body.differentRecipient || !!body.recipientEmail, {
    path: ["recipientEmail"],
    message: "Recipient email required",
  })
  .refine(
    (body) =>
      body.currency === "USD"
        ? body.fxQuoteId === null
        : !!body.fxQuoteId && body.expectedPaymentTotal !== undefined,
    { message: "Currency quote required" },
  );
export const sha256 = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export const privateHash = (value: string, secret: string) =>
  createHmac("sha256", secret).update(value).digest("hex");
export const browserCookie = "mts_checkout_browser";
export function validBrowserToken(value: string | undefined): value is string {
  return /^[a-f0-9]{64}$/.test(value ?? "");
}
export function sameHash(a: string, b: string) {
  if (!/^[a-f0-9]{64}$/.test(a) || !/^[a-f0-9]{64}$/.test(b)) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
export function checkoutOrigin(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("Invalid checkout origin");
  if (
    url.username ||
    url.password ||
    url.hash ||
    url.search ||
    url.pathname !== "/"
  )
    throw new Error("Invalid checkout origin");
  return url.origin;
}
export function resultPath(locale: "es" | "en", orderId: string) {
  if (!z.uuid().safeParse(orderId).success) throw new Error("Invalid order");
  return `/${locale}/checkout/result?order=${orderId}`;
}
export function stripeCheckoutURL(value: string | null) {
  if (!value) throw new Error("Missing checkout URL");
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.hostname !== "checkout.stripe.com" ||
    url.username ||
    url.password
  )
    throw new Error("Invalid Stripe URL");
  return value;
}
export const handledEvents = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);
export type ExpectedPayment = {
  id: string;
  amount_total: number;
  livemode?: boolean;
  stripe_session_id: string | null;
  payment_currency?: string | null;
  payment_total?: number | null;
  items: {
    stripe_price_id: string;
    quantity: number;
    unit_amount: number;
    payment_stripe_price_id?: string | null;
    payment_unit_amount?: number | null;
  }[];
};
export function verifyPaymentSnapshot(
  order: ExpectedPayment,
  session: {
    id: string;
    livemode: boolean;
    mode: string | null;
    client_reference_id: string | null;
    metadata: Record<string, string> | null;
    currency: string | null;
    amount_total: number | null;
  },
  lines: { priceId: string; quantity: number | null; amount: number }[],
) {
  if (
    session.livemode !== (order.livemode ?? false) ||
    session.mode !== "payment" ||
    session.id !== order.stripe_session_id ||
    session.client_reference_id !== order.id ||
    session.metadata?.mts_order_id !== order.id ||
    !currencyCode(order.payment_currency ?? "USD") ||
    session.currency !== (order.payment_currency ?? "USD").toLowerCase() ||
    session.amount_total !== (order.payment_total ?? order.amount_total) ||
    ((order.payment_currency ?? "USD") !== "USD" &&
      order.items.some(
        (item) =>
          !item.payment_stripe_price_id || item.payment_unit_amount == null,
      )) ||
    lines.length !== order.items.length ||
    new Set(lines.map((l) => l.priceId)).size !== lines.length ||
    order.items.some(
      (item) =>
        !lines.some(
          (l) =>
            l.priceId ===
              (item.payment_stripe_price_id ?? item.stripe_price_id) &&
            l.quantity === item.quantity &&
            l.amount ===
              (item.payment_unit_amount ?? item.unit_amount) * item.quantity,
        ),
    )
  )
    throw new Error("Payment identity mismatch");
}
