import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  authorizedHoldOrder,
  validHoldOrigin,
  reconcileHold,
  holdState,
} from "@/lib/payments/hold-server";
import {
  paymentEnvironment,
  checkoutDatabase,
  checkoutStripe,
  paymentHeaders,
} from "@/lib/payments/checkout-server";
import { verifyHoldSession } from "@/lib/payments/hold-policy";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const fail = (status: number) =>
    NextResponse.json(
      { error: "order_unavailable" },
      { status, headers: paymentHeaders },
    );
  try {
    if (!validHoldOrigin(request)) return fail(403);
    const text = await request.text();
    if (text.length > 1024) return fail(413);
    const parsed = z
      .object({ orderId: z.uuid() })
      .strict()
      .safeParse(JSON.parse(text));
    if (!parsed.success) return fail(400);
    let order = await authorizedHoldOrder(request, parsed.data.orderId);
    if (!order) return fail(404);
    order = await reconcileHold(order, true);
    if (order.status !== "pending" || order.payment_in_progress)
      return NextResponse.json(holdState(order), { headers: paymentHeaders });
    if (!order.stripe_session_id) return fail(409);
    const session = await checkoutStripe(
      order.livemode,
    ).checkout.sessions.retrieve(order.stripe_session_id);
    verifyHoldSession(order, session);
    if (
      session.status !== "open" ||
      session.ui_mode !== "elements" ||
      !session.client_secret
    )
      return fail(409);
    const { error } = await checkoutDatabase().rpc("touch_checkout_payment", {
      p_id: order.id,
      p_action: "active",
    });
    if (error) return fail(503);
    return NextResponse.json(
      {
        ...holdState(order),
        clientSecret: session.client_secret,
        publishableKey: paymentEnvironment(
          process.env,
          order.livemode ? "live" : "test",
        ).publicKey,
        total: order.payment_total ?? order.amount_total,
        currency: order.payment_currency ?? "USD",
        buyer: order.billing_email ?? order.recipient_email,
        recipient: order.recipient_email,
      },
      { headers: paymentHeaders },
    );
  } catch {
    return fail(503);
  }
}
