import { refundDecision, type RefundSnapshot } from "./refund-core.ts";
type Payload = {
  payment_intent: string;
  amount: number;
  reason: "requested_by_customer";
  metadata: { mts_refund_request: string; mts_order_id: string };
};
export async function dispatchRefund<T extends { id: string }>(
  snapshot: RefundSnapshot,
  orderId: string,
  attempts: number,
  transport: {
    create: (
      payload: Payload,
      options: { idempotencyKey: string },
    ) => Promise<T>;
    existing: (id: string) => T | undefined;
  },
  now = Date.now(),
): Promise<T> {
  const decision = refundDecision(snapshot, now);
  if (
    decision.action === "review" ||
    (decision.action === "create" && attempts > 8)
  )
    throw Error("Manual refund review required");
  if (decision.action === "reconcile") {
    const existing = transport.existing(decision.id);
    if (!existing) throw Error("Refund snapshot unavailable");
    return existing;
  }
  return transport.create(
    {
      payment_intent: snapshot.order.paymentIntent,
      amount: snapshot.request.amount,
      reason: "requested_by_customer",
      metadata: {
        mts_refund_request: snapshot.request.id,
        mts_order_id: orderId,
      },
    },
    { idempotencyKey: `mts-refund-v1-${snapshot.request.id}` },
  );
}
