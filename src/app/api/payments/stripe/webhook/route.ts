import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  handledEvents,
  verifyPaymentSnapshot,
} from "@/lib/payments/checkout-core";
import {
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
  const secret = process.env.STRIPE_TEST_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret?.startsWith("whsec_") || !signature) return reply(400);
  if (Number(request.headers.get("content-length")) > 262144) return reply(413);
  let event;
  try {
    const raw = await request.text();
    if (raw.length > 262144) return reply(413);
    event = checkoutStripe().webhooks.constructEvent(raw, signature, secret);
  } catch {
    return reply(400);
  }
  if (event.livemode || !handledEvents.has(event.type)) return reply(200);
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
      .select("id,amount_total,stripe_session_id")
      .eq("id", orderId)
      .maybeSingle();
    if (error || !order) return reply(503);
    const { data: items, error: itemError } = await db
      .from("checkout_order_items")
      .select("stripe_price_id,quantity,unit_amount")
      .eq("order_id", orderId);
    if (itemError || !items?.length) return reply(503);
    const stripe = checkoutStripe();
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
    const { error: recordError } = await db.rpc("record_test_checkout_event", {
      p_event_id: event.id,
      p_event_type: event.type,
      p_order_id: order.id,
      p_session_id: session.id,
      p_status: status,
      p_amount: session.amount_total,
      p_currency: session.currency,
      p_payment_intent: paymentIntent,
    });
    return reply(recordError ? 503 : 200);
  } catch {
    return reply(503);
  }
}
