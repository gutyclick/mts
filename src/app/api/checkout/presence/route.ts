import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  authorizedHoldOrder,
  validHoldOrigin,
  reconcileHold,
  holdOrder,
  holdState,
} from "@/lib/payments/hold-server";
import {
  checkoutDatabase,
  paymentHeaders,
} from "@/lib/payments/checkout-server";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const fail = (status: number) =>
    NextResponse.json(
      { error: "order_unavailable" },
      { status, headers: paymentHeaders },
    );
  try {
    if (!validHoldOrigin(request)) return fail(403);
    if (Number(request.headers.get("content-length")) > 2048) return fail(413);
    const text = await request.text();
    if (text.length > 2048) return fail(413);
    const parsed = z
      .object({ orderId: z.uuid(), action: z.enum(["active", "leave"]) })
      .strict()
      .safeParse(JSON.parse(text));
    if (!parsed.success) return fail(400);
    let order = await authorizedHoldOrder(request, parsed.data.orderId);
    if (!order) return fail(404);
    order = await reconcileHold(order);
    const { error } = await checkoutDatabase().rpc("touch_checkout_payment", {
      p_id: order.id,
      p_action: parsed.data.action,
    });
    if (error) return fail(503);
    return NextResponse.json(holdState((await holdOrder(order.id))!), {
      headers: paymentHeaders,
    });
  } catch {
    return fail(503);
  }
}
