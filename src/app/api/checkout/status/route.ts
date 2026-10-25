import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  browserCookie,
  sameHash,
  sha256,
  validBrowserToken,
} from "@/lib/payments/checkout-core";
import {
  checkoutDatabase,
  paymentHeaders,
} from "@/lib/payments/checkout-server";
import { authClient } from "@/lib/supabase/auth-server";
import { holdOrder, reconcileHold } from "@/lib/payments/hold-server";

export async function GET(request: NextRequest) {
  const fail = (status: number) =>
    NextResponse.json(
      { error: "order_unavailable" },
      { status, headers: paymentHeaders },
    );
  const id = request.nextUrl.searchParams.get("order");
  if (!z.uuid().safeParse(id).success) return fail(404);
  try {
    const db = checkoutDatabase();
    const { data: rawOrder, error } = await db
      .from("checkout_orders")
      .select(
        "id,user_id,browser_hash,status,amount_total,currency,livemode,created_at,payment_hold_expires_at,payment_in_progress",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) return fail(503);
    if (!rawOrder) return fail(404);
    let order = rawOrder;
    const token = request.cookies.get(browserCookie)?.value;
    let authorized =
      validBrowserToken(token) && sameHash(sha256(token), order.browser_hash);
    if (!authorized && order.user_id) {
      const {
        data: { user },
      } = await (await authClient()).auth.getUser();
      authorized = !!user?.email_confirmed_at && user.id === order.user_id;
    }
    if (!authorized) return fail(404);
    const reconciled = await reconcileHold(
      (await holdOrder(order.id))!,
      request.nextUrl.searchParams.get("inspect") === "1",
    );
    order = {
      ...order,
      status: reconciled.status,
      payment_hold_expires_at: reconciled.payment_hold_expires_at,
      payment_in_progress: reconciled.payment_in_progress,
    };
    const { data: items, error: itemsError } = await db
      .from("checkout_order_items")
      .select(
        "plan_id,destination_slug,destination_name,plan_name,data_gb,days,quantity,unit_amount",
      )
      .eq("order_id", id)
      .order("plan_id");
    if (itemsError) return fail(503);
    return NextResponse.json(
      {
        id: order.id,
        status: order.status,
        total: order.amount_total,
        currency: order.currency,
        test: !order.livemode,
        items,
        holdExpiresAt: order.payment_hold_expires_at,
        paymentInProgress: order.payment_in_progress,
        serverTime: new Date().toISOString(),
      },
      { headers: paymentHeaders },
    );
  } catch {
    return fail(503);
  }
}
