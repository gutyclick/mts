import { z } from "zod";
const cents = z.number().int().min(0).max(99999999);
const unit = cents.positive().refine((v) => v % 100 === 0);
const reference = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[^\u0000-\u001f\u007f]+$/u);
export const commerceSettings = z
  .object({
    bank_enabled: z.boolean(),
    bank_instructions: z.string().trim().max(2000),
    stripe_enabled: z.boolean(),
    yappy_enabled: z.boolean(),
    yappy_fee_bps: z.number().int().min(0).max(7999).nullable(),
    yappy_fixed_cents: cents,
    other_reserve_cents: cents,
    issuance_enabled: z.boolean(),
  })
  .strict()
  .refine((v) => !v.bank_enabled || v.bank_instructions.length >= 10)
  .refine((v) => !v.yappy_enabled || v.yappy_fee_bps !== null);
export const commerceAdminAction = z.discriminatedUnion("action", [
  z
    .object({ action: z.literal("save_settings"), value: commerceSettings })
    .strict(),
  z
    .object({
      action: z.literal("save_tariff"),
      planId: z.string().min(1).max(200),
      companyId: z.uuid().nullable(),
      unitCents: unit,
      active: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("publish_quote"),
      requestId: z.uuid(),
      version: z.number().int().positive(),
      unitCents: unit.optional(),
      taxCents: cents,
      validHours: z.number().int().min(1).max(168),
    })
    .strict(),
  z
    .object({
      action: z.literal("confirm_transfer"),
      orderId: z.uuid(),
      reference,
      amountCents: cents.positive(),
    })
    .strict(),
  z
    .object({ action: z.enum(["release", "notify"]), orderId: z.uuid() })
    .strict(),
]);
export const commerceCustomerAction = z
  .object({
    action: z.enum(["stripe", "yappy", "transfer_notice"]),
    orderId: z.uuid(),
    reference: reference.optional(),
  })
  .strict();
export function commerceError(error: unknown) {
  const message =
    typeof error === "object" && error !== null && "message" in error
      ? String(error.message)
      : "";
  const aliases: Record<string, string> = {
    fresh_cost_required: "stale_cost",
    tariff_required: "no_tariff",
    active_payment_attempt: "payment_pending",
    quote_unavailable: "quote_expired",
    request_conflict: "conflict",
    quantity_limit: "batch_limit",
    payment_required: "unpaid",
    issuance_disabled: "not_configured",
    method_disabled: "not_configured",
    plan_unavailable: "plan_unavailable",
    role_required: "forbidden",
    company_required: "forbidden",
    reference_used: "reference_used",
    payment_mismatch: "invalid",
    manual_review_required: "review_required",
    test_payment_not_fulfillable: "test_payment_not_fulfillable",
    provider_identity_mismatch: "plan_unavailable",
    quote_fee_mismatch: "quote_fee_mismatch",
  };
  if (aliases[message]) return aliases[message];
  return (
    [
      "forbidden",
      "invalid",
      "not_found",
      "conflict",
      "stale_cost",
      "insufficient_margin",
      "payment_pending",
      "quote_expired",
      "not_configured",
      "batch_limit",
      "no_tariff",
      "unpaid",
      "already_released",
      "unavailable",
    ].find((code) => message === code) ?? "unavailable"
  );
}
