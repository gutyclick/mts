import { z } from "zod";
import { currencySchema } from "../currency-schema.ts";
export const refundStates = [
  "requested",
  "approved",
  "processing",
  "pending",
  "succeeded",
  "failed",
  "rejected",
  "review",
] as const;
export const refundRecord = z.object({
  id: z.uuid(),
  order_id: z.uuid(),
  amount: z.number().int().positive(),
  currency: currencySchema,
  livemode: z.boolean(),
  state: z.enum(refundStates),
  reason: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
  stripe_refund_id: z.string().nullable(),
});
export const refundView = z.object({
  audit: z.array(
    z.object({
      request_id: z.uuid(),
      actor: z.uuid().nullable(),
      action: z.string(),
      created_at: z.string(),
    }),
  ),
  recent: z.array(refundRecord),
  order: z
    .object({
      id: z.uuid(),
      status: z.string(),
      amount: z.number(),
      currency: currencySchema,
      livemode: z.boolean(),
      units: z.array(
        z.object({
          id: z.uuid(),
          plan: z.string(),
          destination: z.record(z.string(), z.string()),
          dataGb: z.coerce.number(),
          days: z.number(),
          amount: z.number(),
          state: z.string(),
          issued: z.boolean(),
          reserved: z.uuid().nullable(),
        }),
      ),
    })
    .nullable(),
});
export type RefundView = z.infer<typeof refundView>;
export const refundLabels = {
  es: {
    requested: "Pendiente de revisión",
    approved: "Autorizado",
    processing: "Comprobando en Stripe",
    pending: "Pendiente en Stripe",
    succeeded: "Reembolsado",
    failed: "No realizado",
    rejected: "Rechazado",
    review: "Requiere revisión",
  },
  en: {
    requested: "Awaiting review",
    approved: "Approved",
    processing: "Checking Stripe",
    pending: "Pending in Stripe",
    succeeded: "Refunded",
    failed: "Not completed",
    rejected: "Rejected",
    review: "Needs review",
  },
};
