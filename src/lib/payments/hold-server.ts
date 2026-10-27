import "server-only";
import { NextRequest } from "next/server";
import { z } from "zod";
import {
  checkoutDatabase,
  checkoutStripe,
  paymentOrigin,
} from "./checkout-server";
import { authClient } from "../supabase/auth-server";
import {
  browserCookie,
  validBrowserToken,
  sameHash,
  sha256,
} from "./checkout-core";
import { closeUnpaidCheckout, verifyHoldSession } from "./hold-policy";

const schema = z.object({
  id: z.uuid(),
  user_id: z.string().nullable(),
  browser_hash: z.string(),
  status: z.enum(["pending", "paid", "expired", "failed", "cancelled"]),
  amount_total: z.number().int(),
  payment_currency:z.string().nullable(),
  payment_total:z.number().int().nullable(),
  currency: z.literal("usd"),
  livemode: z.boolean(),
  locale: z.enum(["es", "en"]),
  stripe_session_id: z.string().nullable(),
  billing_email: z.string().nullable(),
  recipient_email: z.string(),
  marketing_opt_in: z.boolean(),
  payment_hold_expires_at: z.string().nullable(),
  payment_in_progress: z.boolean(),
});
export type HoldOrder = z.infer<typeof schema>;
export async function holdOrder(id: string) {
  const { data, error } = await checkoutDatabase()
    .from("checkout_orders")
    .select(
      "id,user_id,browser_hash,status,amount_total,currency,payment_currency,payment_total,livemode,locale,stripe_session_id,billing_email,recipient_email,marketing_opt_in,payment_hold_expires_at,payment_in_progress",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Order unavailable");
  return data ? schema.parse(data) : null;
}
export async function authorizedHoldOrder(request: NextRequest, id: string) {
  const order = await holdOrder(id);
  if (!order) return null;
  const token = request.cookies.get(browserCookie)?.value;
  if (order.user_id) {
    const {
      data: { user },
    } = await (await authClient()).auth.getUser();
    return user?.email_confirmed_at && user.id === order.user_id ? order : null;
  }
  if (validBrowserToken(token) && sameHash(sha256(token), order.browser_hash))
    return order;
  return null;
}
export function validHoldOrigin(request: NextRequest) {
  return request.headers.get("origin") === paymentOrigin();
}
export async function reconcileHold(order: HoldOrder, inspect = false) {
  if (order.status !== "pending" || order.payment_in_progress) return order;
  const due =
    !!order.payment_hold_expires_at &&
    new Date(order.payment_hold_expires_at).getTime() <= Date.now();
  if (!due && !inspect) return order;
  const db = checkoutDatabase();
  const stripe = checkoutStripe(order.livemode);
  let result: "cancelled" | "processing" | "expired" | null = null;
  if (due)
    result = await closeUnpaidCheckout(order, {
      retrieve: (id) => stripe.checkout.sessions.retrieve(id),
      expire: (id) =>
        stripe.checkout.sessions.expire(
          id,
          {},
          { idempotencyKey: `mts_hold_expire_${id}` },
        ),
    });
  else if (order.stripe_session_id) {
    const session = await stripe.checkout.sessions.retrieve(
      order.stripe_session_id,
    );
    verifyHoldSession(order, session);
    if (session.status === "complete" || session.payment_status === "paid")
      result = "processing";
    else if (session.status === "expired") result = "expired";
  }
  if (result) {
    const { error } = await db
      .from("checkout_orders")
      .update(
        result === "processing"
          ? { payment_in_progress: true, expiry_lease_until: null }
          : { status: result, expiry_lease_until: null },
      )
      .eq("id", order.id)
      .eq("status", "pending")
      .eq("payment_in_progress", false);
    if (error) throw new Error("Could not reconcile order");
  }
  return (await holdOrder(order.id))!;
}
export function holdState(order: HoldOrder) {
  return {
    id: order.id,
    status: order.status,
    holdExpiresAt: order.payment_hold_expires_at,
    paymentInProgress: order.payment_in_progress,
    serverTime: new Date().toISOString(),
  };
}
