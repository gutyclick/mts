export const PAYMENT_HOLD_MS = 5 * 60 * 1000;
import { currencyCode } from "../currency.ts";
export const pendingPaymentKey = "mytripsim.pending-payment.v1";
export function remainingHoldSeconds(
  deadline: string | null,
  now = Date.now(),
) {
  if (!deadline) return null;
  const value = new Date(deadline).getTime();
  return Number.isFinite(value)
    ? Math.max(0, Math.ceil((value - now) / 1000))
    : null;
}
export type HoldSession = {
  id: string;
  livemode: boolean;
  status: string | null;
  payment_status: string;
  client_reference_id: string | null;
  metadata: Record<string, string> | null;
  currency: string | null;
  amount_total: number | null;
};
export type HoldOrder = {
  id: string;
  stripe_session_id: string | null;
  amount_total: number;
  payment_currency?: string | null;
  payment_total?: number | null;
  livemode?: boolean;
};
export function verifyHoldSession(order: HoldOrder, session: HoldSession) {
  if (
    session.livemode !== (order.livemode ?? false) ||
    session.id !== order.stripe_session_id ||
    session.client_reference_id !== order.id ||
    session.metadata?.mts_order_id !== order.id ||
    !currencyCode(order.payment_currency ?? "USD") ||
    session.currency !== (order.payment_currency ?? "USD").toLowerCase() ||
    session.amount_total !== (order.payment_total ?? order.amount_total)
  )
    throw new Error("Session identity mismatch");
}
export async function closeUnpaidCheckout(
  order: HoldOrder,
  gateway: {
    retrieve: (id: string) => Promise<HoldSession>;
    expire: (id: string) => Promise<HoldSession>;
  },
) {
  if (!order.stripe_session_id) return "cancelled" as const;
  let session = await gateway.retrieve(order.stripe_session_id);
  verifyHoldSession(order, session);
  if (session.status === "open" && session.payment_status !== "paid") {
    try {
      session = await gateway.expire(session.id);
    } catch {
      session = await gateway.retrieve(session.id);
    }
    verifyHoldSession(order, session);
  }
  if (session.status === "complete" || session.payment_status === "paid")
    return "processing" as const;
  if (session.status === "expired") return "cancelled" as const;
  throw new Error("Session could not be closed");
}
