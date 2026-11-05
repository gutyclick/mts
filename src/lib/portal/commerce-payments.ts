import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type Stripe from "stripe";
import {
  checkoutDatabase,
  checkoutStripe,
  paymentMode,
} from "../payments/checkout-server";
import { createYappyOrder, yappyConfig } from "../integrations/yappy";
import {
  commercialOrder,
  commercialSettings,
  commerceReadiness,
  portalOrigin,
  refreshBusinessCost,
} from "./commerce-server";
import { verifyBusinessStripePayment } from "./payment-snapshot";

const attemptSchema = z.object({
  id: z.uuid(),
  order_id: z.uuid(),
  method: z.enum(["stripe", "yappy", "transfer"]),
  livemode: z.boolean(),
  provider_ref: z.string(),
  session_id: z.string().nullable(),
  expected_amount_cents: z.number().int().positive(),
  status: z.string(),
  locale: z.enum(["es", "en"]),
  created_at: z.string().datetime({ offset: true }),
});
async function record(action: string, value: Record<string, unknown>) {
  const result = await checkoutDatabase().rpc("b2b_commerce_payment", {
    p_action: action,
    p_value: value,
  });
  if (result.error) throw Error(result.error.message);
  return result.data;
}
export async function beginBusinessPayment(
  orderId: string,
  actor: string,
  method: "stripe" | "yappy",
  locale: "es" | "en",
) {
  const order = await commercialOrder(orderId),
    settings = await commercialSettings(),
    ready = commerceReadiness();
  if (order.state !== "awaiting_payment" || order.paid_at)
    throw Error("conflict");
  if (Date.parse(order.quote_expires_at) <= Date.now())
    throw Error("quote_expired");
  if (
    method === "stripe"
      ? !settings.stripe_enabled || !ready.stripe
      : !settings.yappy_enabled || !ready.yappy
  )
    throw Error("not_configured");
  await refreshBusinessCost(order.plan_id);
  const id = randomUUID(),
    live = paymentMode(process.env) === "live";
  const attempt = attemptSchema.parse(
    await record("begin", {
      id,
      actor,
      order_id: orderId,
      method,
      livemode: live,
      locale,
      expected_amount_cents: order.total_cents,
      provider_ref:
        method === "yappy" ? id.replaceAll("-", "").slice(0, 15) : id,
    }),
  );
  if (attempt.status === "succeeded") throw Error("conflict");
  if (attempt.livemode !== live || attempt.method !== method)
    throw Error("payment_pending");
  if (
    !attempt.session_id &&
    Date.now() - Date.parse(attempt.created_at) > 20 * 60000
  )
    throw Error("payment_pending");
  if (method === "stripe") {
    const stripe = checkoutStripe(live);
    const returnUrl = `${portalOrigin}/${attempt.locale}/${attempt.locale === "es" ? "viajes" : "trips"}/${order.trip_id}`;
    const session = attempt.session_id
      ? await stripe.checkout.sessions.retrieve(attempt.session_id)
      : await stripe.checkout.sessions.create(
          {
            mode: "payment",
            client_reference_id: order.id,
            line_items: [
              {
                price_data: {
                  currency: "usd",
                  unit_amount: order.unit_cents,
                  product_data: { name: order.plan_name },
                },
                quantity: order.quantity,
              },
              ...(order.tax_cents
                ? [
                    {
                      price_data: {
                        currency: "usd",
                        unit_amount: order.tax_cents,
                        product_data: {
                          name: attempt.locale === "es" ? "Impuestos" : "Taxes",
                        },
                      },
                      quantity: 1,
                    },
                  ]
                : []),
            ],
            metadata: {
              mts_b2b_order_id: order.id,
              mts_b2b_attempt_id: attempt.id,
            },
            payment_intent_data: {
              metadata: {
                mts_b2b_order_id: order.id,
                mts_b2b_attempt_id: attempt.id,
              },
            },
            success_url: `${returnUrl}?payment=received`,
            cancel_url: `${returnUrl}?payment=returned`,
            expires_at:
              Math.floor(Date.parse(attempt.created_at) / 1000) + 2100,
          },
          { idempotencyKey: `mts-b2b-checkout-v1-${attempt.id}` },
        );
    if (
      session.livemode !== live ||
      session.amount_total !== order.total_cents ||
      session.currency !== "usd"
    )
      throw Error("unavailable");
    await record("bind", {
      id: attempt.id,
      provider_ref: attempt.provider_ref,
      session_id: session.id,
    });
    if (!session.url || !session.url.startsWith("https://checkout.stripe.com/"))
      throw Error("payment_pending");
    return { url: session.url };
  }
  const config = yappyConfig(process.env, live);
  if (!config) throw Error("not_configured");
  if (attempt.id !== id) throw Error("payment_pending");
  // An uncertain Yappy creation must be reconciled rather than generating a new order ID.
  const response = await createYappyOrder(config, {
    orderId: attempt.provider_ref,
    totalCents: order.total_cents,
    taxCents: order.tax_cents,
    ipnUrl: `${portalOrigin}/api/portal/commerce/yappy-ipn`,
  });
  await record("bind", {
    id: attempt.id,
    provider_ref: attempt.provider_ref,
    session_id: response.transactionId,
  });
  return response;
}
export async function handleBusinessStripeEvent(
  event: Stripe.Event,
): Promise<boolean> {
  const object = event.data.object;
  if (object.object === "charge" && event.type === "charge.refunded") {
    const id = object.metadata?.mts_b2b_attempt_id;
    if (!z.uuid().safeParse(id).success) return false;
    const current = await checkoutStripe(event.livemode).charges.retrieve(
      object.id,
    );
    if (
      current.livemode !== event.livemode ||
      current.metadata.mts_b2b_attempt_id !== id ||
      current.amount_refunded <= 0
    )
      throw Error("payment_mismatch");
    const result = await checkoutDatabase()
      .from("b2b_payment_attempts")
      .select("*")
      .eq("id", id)
      .single();
    if (result.error) throw Error("unavailable");
    const a = attemptSchema.parse(result.data);
    if (
      a.method !== "stripe" ||
      a.livemode !== event.livemode ||
      current.amount !== a.expected_amount_cents ||
      current.currency !== "usd" ||
      current.metadata.mts_b2b_order_id !== a.order_id
    )
      throw Error("payment_mismatch");
    await record("refund", {
      id: a.id,
      provider_ref: a.provider_ref,
      amount_cents: current.amount_refunded,
      livemode: event.livemode,
      event_id: event.id,
    });
    return true;
  }
  if (
    object.object !== "checkout.session" ||
    ![
      "checkout.session.completed",
      "checkout.session.expired",
      "checkout.session.async_payment_succeeded",
      "checkout.session.async_payment_failed",
    ].includes(event.type)
  )
    return false;
  const id = object.metadata?.mts_b2b_attempt_id;
  if (!z.uuid().safeParse(id).success) return false;
  const result = await checkoutDatabase()
    .from("b2b_payment_attempts")
    .select("*")
    .eq("id", id)
    .single();
  if (result.error) throw Error("unavailable");
  const attempt = attemptSchema.parse(result.data);
  const session = await checkoutStripe(
    event.livemode,
  ).checkout.sessions.retrieve(object.id);
  // Creation response can race the webhook; bind only the same immutable metadata and amount.
  if (!attempt.session_id) {
    if (
      session.metadata?.mts_b2b_attempt_id !== attempt.id ||
      session.metadata?.mts_b2b_order_id !== attempt.order_id ||
      session.amount_total !== attempt.expected_amount_cents ||
      session.livemode !== attempt.livemode
    )
      throw Error("payment_mismatch");
    await record("bind", {
      id: attempt.id,
      provider_ref: attempt.provider_ref,
      session_id: session.id,
    });
    attempt.session_id = session.id;
  }
  let status = verifyBusinessStripePayment(attempt, session);
  if (
    status === "pending" &&
    event.type === "checkout.session.async_payment_failed"
  )
    status = "cancelled";
  if (status !== "pending")
    await record("settle", {
      id: attempt.id,
      provider_ref: attempt.provider_ref,
      amount_cents: attempt.expected_amount_cents,
      currency: "USD",
      livemode: event.livemode,
      status,
      event_id: event.id,
    });
  return true;
}
export {
  record as recordBusinessPayment,
  attemptSchema as businessAttemptSchema,
};
