import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authorizedHoldOrder } from "@/lib/payments/hold-server";
import {
  paymentHeaders,
  checkoutDatabase,
} from "@/lib/payments/checkout-server";
import { fulfillmentUnits, publicUnit } from "@/lib/fulfillment/server";
export async function GET(request: NextRequest) {
  const fail = (status: number) =>
    NextResponse.json(
      { error: "delivery_unavailable" },
      { status, headers: paymentHeaders },
    );
  const id = request.nextUrl.searchParams.get("order"),
    unitId = request.nextUrl.searchParams.get("unit");
  if (
    !z.uuid().safeParse(id).success ||
    (unitId && !z.uuid().safeParse(unitId).success)
  )
    return fail(404);
  try {
    const order = await authorizedHoldOrder(request, id!);
    if (!order) return fail(404);
    if (order.status !== "paid")
      return NextResponse.json({ units: [] }, { headers: paymentHeaders });
    const units = await fulfillmentUnits(order.id);
    if (unitId && !units.some((u) => u.id === unitId)) return fail(404);
    const { data: lines, error } = await checkoutDatabase()
      .from("checkout_order_items")
      .select("plan_id,plan_name,data_gb,days")
      .eq("order_id", id!);
    if (error) throw new Error("Delivery unavailable");
    return NextResponse.json(
      {
        units: await Promise.all(
          units
            .filter((u) => !unitId || u.id === unitId)
            .map(async (u) => ({
              ...(await publicUnit(u, !!unitId)),
              name:
                lines?.find((l) => l.plan_id === u.plan_id)?.plan_name ?? "",
              qa: u.qa_authorized === true,
            })),
        ),
      },
      { headers: paymentHeaders },
    );
  } catch {
    return fail(503);
  }
}
