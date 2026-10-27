export type RefundSnapshot = {
  order: {
    amount: number;
    currency: string;
    livemode: boolean;
    paymentIntent: string;
    status: string;
  };
  request: {
    id: string;
    amount: number;
    firstAttemptAt: string;
    stripeRefundId: string | null;
  };
  payment: {
    id: string;
    amountReceived: number;
    currency: string;
    livemode: boolean;
    status: string;
    disputed: boolean;
  };
  refunds: {
    id: string;
    requestId: string | null;
    amount: number;
    currency: string;
    paymentIntent: string;
    status: string | null;
  }[];
  hasMore: boolean;
  knownRequestIds: string[];
};
type Decision =
  | { action: "create" }
  | { action: "reconcile"; id: string }
  | {
      action: "review";
      reason:
        | "payment_mismatch"
        | "refund_mismatch"
        | "external_refund"
        | "remaining_amount"
        | "retry_window";
    };

// The server supplies immutable order/request amounts and an authoritative Stripe snapshot.
// Unknown outcomes require reconciliation; they never justify a new idempotency key.
export function refundDecision(
  snapshot: RefundSnapshot,
  now = Date.now(),
): Decision {
  const { order, request, payment, refunds } = snapshot;
  if (
    order.status !== "paid" ||
    payment.status !== "succeeded" ||
    payment.disputed ||
    payment.id !== order.paymentIntent ||
    payment.livemode !== order.livemode ||
    order.currency !== "usd" ||
    payment.currency !== order.currency ||
    payment.amountReceived !== order.amount ||
    !Number.isSafeInteger(order.amount) ||
    order.amount <= 0 ||
    !Number.isSafeInteger(request.amount) ||
    request.amount <= 0 ||
    request.amount > order.amount
  )
    return { action: "review", reason: "payment_mismatch" };
  if (
    snapshot.hasMore ||
    refunds.some(
      (r) =>
        r.currency !== order.currency ||
        r.paymentIntent !== order.paymentIntent ||
        !Number.isSafeInteger(r.amount) ||
        r.amount <= 0 ||
        ![
          "succeeded",
          "pending",
          "requires_action",
          "failed",
          "canceled",
        ].includes(r.status ?? ""),
    )
  )
    return { action: "review", reason: "refund_mismatch" };
  const own = refunds.filter((r) => r.requestId === request.id);
  if (
    own.length > 1 ||
    own.some(
      (r) =>
        r.amount !== request.amount ||
        (request.stripeRefundId !== null && r.id !== request.stripeRefundId),
    )
  )
    return { action: "review", reason: "refund_mismatch" };
  if (own.length === 1) return { action: "reconcile", id: own[0].id };
  if (request.stripeRefundId !== null)
    return { action: "review", reason: "refund_mismatch" };
  if (
    refunds.some(
      (r) => !r.requestId || !snapshot.knownRequestIds.includes(r.requestId),
    )
  )
    return { action: "review", reason: "external_refund" };
  const committed = refunds
    .filter((r) => r.status !== "failed" && r.status !== "canceled")
    .reduce((total, r) => total + r.amount, 0);
  if (
    !Number.isSafeInteger(committed) ||
    committed + request.amount > order.amount
  )
    return { action: "review", reason: "remaining_amount" };
  const first = Date.parse(request.firstAttemptAt);
  if (
    !Number.isFinite(first) ||
    first > now + 60000 ||
    now - first >= 23 * 3600000
  )
    return { action: "review", reason: "retry_window" };
  return { action: "create" };
}
