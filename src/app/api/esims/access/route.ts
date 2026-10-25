import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  checkoutDatabase,
  paymentHeaders,
  paymentOrigin,
} from "@/lib/payments/checkout-server";
import { validDeliveryToken } from "@/lib/fulfillment/core";
import { publicUnit } from "@/lib/fulfillment/server";
export async function POST(request: NextRequest) {
  const fail = (status: number) =>
    NextResponse.json(
      { error: "delivery_unavailable" },
      { status, headers: paymentHeaders },
    );
  if (request.headers.get("origin") !== paymentOrigin()) return fail(403);
  if (Number(request.headers.get("content-length")) > 1024) return fail(413);
  let input;
  try {
    const text = await request.text();
    if (text.length > 1024) return fail(413);
    input = z
      .object({ id: z.uuid(), token: z.string().regex(/^[a-f0-9]{64}$/) })
      .strict()
      .parse(JSON.parse(text));
  } catch {
    return fail(404);
  }
  try {
    const secret = process.env.FULFILLMENT_LINK_SECRET;
    if (!secret) return fail(503);
    const db = checkoutDatabase();
    const { data: unit, error } = await db
      .from("esim_fulfillments")
      .select("*")
      .eq("id", input.id)
      .maybeSingle();
    if (error) throw new Error("Delivery unavailable");
    if (!unit || !validDeliveryToken(unit, input.token, secret))
      return fail(404);
    const { data: order, error: orderError } = await db
      .from("checkout_orders")
      .select("status")
      .eq("id", unit.order_id)
      .single();
    if (orderError) throw new Error("Delivery unavailable");
    if (order.status !== "paid") return fail(404);
    const { data: line, error: lineError } = await db
      .from("checkout_order_items")
      .select("plan_name")
      .eq("order_id", unit.order_id)
      .eq("plan_id", unit.plan_id)
      .single();
    if (lineError) throw new Error("Delivery unavailable");
    return NextResponse.json(
      {
        units: [
          {
            ...(await publicUnit(unit, true)),
            name: line.plan_name,
            qa: unit.qa_authorized === true,
          },
        ],
      },
      { headers: paymentHeaders },
    );
  } catch {
    return fail(503);
  }
}
