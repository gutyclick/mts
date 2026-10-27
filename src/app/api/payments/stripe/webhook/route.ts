import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { recordStripeRefund, refundStripe } from "@/lib/payments/refund-server";
import {
  handledEvents,
  verifyPaymentSnapshot,
} from "@/lib/payments/checkout-core";
import {
  paymentEnvironment,
  checkoutDatabase,
  checkoutStripe,
  paymentHeaders,
} from "@/lib/payments/checkout-server";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const reply = (status: number) =>
    NextResponse.json(
      { received: status === 200 },
      { status, headers: paymentHeaders },
    );
  const signature = request.headers.get("stripe-signature");
  if (!signature) return reply(400);
  if (Number(request.headers.get("content-length")) > 262144) return reply(413);
  let event;
  try {
    const raw = await request.text();
    if (raw.length > 262144) return reply(413);
    for (const mode of ["live", "test"] as const) {
      const config = paymentEnvironment(process.env, mode);
      if (!config.webhook.startsWith("whsec_")) continue;
      try {
        const candidate = checkoutStripe(config.live).webhooks.constructEvent(
          raw,
          signature,
          config.webhook,
        );
        if (candidate.livemode !== config.live) continue;
        event = candidate;
        break;
      } catch {
        /* A signature belongs to exactly one configured environment. */
      }
    }
    if (!event) return reply(400);
  } catch {
    return reply(400);
  }
  if (
    ["refund.created", "refund.updated", "refund.failed"].includes(event.type)
  ) {
    try {
      const object = event.data.object;
      if (object.object !== "refund") return reply(400);
      if (!z.uuid().safeParse(object.metadata?.mts_refund_request).success)
        return reply(200);
      const checkedAt = new Date().toISOString();
      const current = await refundStripe(event.livemode).refunds.retrieve(
        object.id,
      );
      await recordStripeRefund(current, event.livemode, checkedAt);
      return reply(200);
    } catch {
      return reply(503);
    }
  }
  if (!handledEvents.has(event.type)) return reply(200);
  try {
    const object = event.data.object;
    if (object.object !== "checkout.session") return reply(400);
    const orderId = object.metadata?.mts_order_id;
    if (!z.uuid().safeParse(orderId).success) return reply(200);
    const db = checkoutDatabase();
    const { data: duplicate, error: duplicateError } = await db
      .from("checkout_stripe_events")
      .select("id")
      .eq("id", event.id)
      .maybeSingle();
    if (duplicateError) return reply(503);
    if (duplicate) return reply(200);
    const { data: order, error } = await db
      .from("checkout_orders")
      .select(
        "id,amount_total,stripe_session_id,livemode,payment_currency,payment_total",
      )
      .eq("id", orderId)
      .maybeSingle();
    if (error || !order) return reply(503);
    const { data: items, error: itemError } = await db
      .from("checkout_order_items")
      .select(
        "stripe_price_id,quantity,unit_amount,payment_stripe_price_id,payment_unit_amount",
      )
      .eq("order_id", orderId);
    if (itemError || !items?.length) return reply(503);
    const stripe = checkoutStripe(event.livemode);
    const session = await stripe.checkout.sessions.retrieve(object.id);
    const lines = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 100,
    });
    if (lines.has_more) return reply(400);
    verifyPaymentSnapshot(
      { ...order, items },
      session,
      lines.data.map((line) => ({
        priceId: line.price?.id ?? "",
        quantity: line.quantity,
        amount: line.amount_total,
      })),
    );
    const status =
      session.payment_status === "paid"
        ? "paid"
        : session.status === "expired"
          ? "expired"
          : event.type === "checkout.session.async_payment_failed"
            ? "failed"
            : "pending";
    const paymentIntent =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : (session.payment_intent?.id ?? null);
    const { error: recordError } = await db.rpc("record_checkout_event_v2", {
      p_livemode: event.livemode,
      p_event_id: event.id,
      p_event_type: event.type,
      p_order_id: order.id,
      p_session_id: session.id,
      p_status: status,
      // Actual local money and generated Stripe prices were verified above. This
      // legacy ledger contract remains canonical USD for provider/accounting jobs.
      p_amount: order.amount_total,
      p_currency: "usd",
      p_payment_intent: paymentIntent,
    });
    return reply(recordError ? 503 : 200);
  } catch {
    return reply(503);
  }
}
