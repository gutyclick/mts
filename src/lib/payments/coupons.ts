import { z } from "zod";
import { cartSchema } from "../cart.ts";
import { currencies } from "../currency.ts";

export const couponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .min(3)
  .max(40)
  .regex(/^[A-Z0-9][A-Z0-9_-]*$/);
const money = z.number().int().min(0).max(99999999);
const limit = z.number().int().min(1).max(10000000).nullable();
const timestamp = z.iso.datetime({ offset: true }).nullable();
export const couponValueSchema = z
  .object({
    id: z.uuid().optional(),
    code: couponCodeSchema,
    name: z.string().trim().min(1).max(100),
    kind: z.enum(["percent", "fixed"]),
    value: money.refine((value) => value > 0),
    starts_at: timestamp,
    ends_at: timestamp,
    max_uses: limit,
    max_uses_per_customer: limit,
    minimum_cents: money,
    active: z.boolean(),
  })
  .strict()
  .refine((v) => v.kind !== "percent" || v.value <= 10000, {
    message: "Percentage must be between 0.01% and 100%",
  })
  .refine(
    (v) =>
      !v.starts_at ||
      !v.ends_at ||
      Date.parse(v.ends_at) > Date.parse(v.starts_at),
    {
      message: "End must follow start",
    },
  );
export const couponAdminRequestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("save"),
      request: z.uuid(),
      value: couponValueSchema,
    })
    .strict(),
  z
    .object({
      action: z.literal("archive"),
      request: z.uuid(),
      value: z.object({ id: z.uuid() }).strict(),
    })
    .strict(),
]);
export const couponQuoteRequestSchema = z
  .object({
    code: couponCodeSchema,
    email: z.email().max(254),
    lines: cartSchema.refine((lines) => lines.length > 0),
    currency: z.enum(currencies.map((c) => c.code)),
    fxQuoteId: z.uuid().nullable(),
  })
  .strict()
  .refine((v) => (v.currency === "USD" ? v.fxQuoteId === null : !!v.fxQuoteId));
export const couponQuoteSchema = z.object({
  id: z.uuid(),
  code: couponCodeSchema,
  currency: z.enum(currencies.map((c) => c.code)),
  paymentTotal: money.refine((v) => v > 0),
  discountTotal: money.refine((v) => v > 0),
  discountUsdCents: money.refine((v) => v > 0),
  expiresAt: z.iso.datetime({ offset: true }),
});
export type CouponQuote = z.infer<typeof couponQuoteSchema>;
export function couponFailure(error: string): string {
  return (
    [
      "invalid_coupon",
      "coupon_limit",
      "coupon_margin",
      "coupon_expired",
      "quote_expired",
      "rate_limit",
    ].find((code) => error.includes(code)) ?? "coupon_unavailable"
  );
}
