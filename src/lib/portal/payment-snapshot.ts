export type BusinessPaymentSnapshot = {
  id: string;
  order_id: string;
  method: string;
  livemode: boolean;
  provider_ref: string;
  session_id: string | null;
  expected_amount_cents: number;
};
export function verifyBusinessStripePayment(
  attempt: BusinessPaymentSnapshot,
  session: {
    id: string;
    livemode: boolean;
    currency: string | null;
    amount_total: number | null;
    metadata: Record<string, string> | null;
    payment_status: string;
    status: string | null;
  },
) {
  if (
    attempt.method !== "stripe" ||
    attempt.session_id !== session.id ||
    attempt.livemode !== session.livemode ||
    session.currency !== "usd" ||
    session.amount_total !== attempt.expected_amount_cents ||
    session.metadata?.mts_b2b_order_id !== attempt.order_id ||
    session.metadata?.mts_b2b_attempt_id !== attempt.id
  )
    throw Error("payment_mismatch");
  return session.payment_status === "paid"
    ? "succeeded"
    : session.status === "expired"
      ? "cancelled"
      : "pending";
}
