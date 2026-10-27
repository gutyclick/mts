import test from "node:test";
import assert from "node:assert/strict";
import { refundDecision } from "../src/lib/payments/refund-core.ts";
import { dispatchRefund } from "../src/lib/payments/refund-execution.ts";
const now = Date.now();

test("lost create responses reconcile the same refund without a second monetary effect", async () => {
  const snapshot = fixture();
  let calls = 0,
    stored;
  const transport = {
    create: async (payload, options) => {
      calls++;
      assert.equal(options.idempotencyKey, "mts-refund-v1-request_fixture");
      assert.equal(payload.amount, 400);
      stored = refund();
      throw Error("Response lost after upstream accepted");
    },
    existing: (id) => (stored?.id === id ? stored : undefined),
  };
  await assert.rejects(
    dispatchRefund(snapshot, "order_fixture", 1, transport, now),
  );
  snapshot.refunds = [stored];
  const result = await dispatchRefund(
    snapshot,
    "order_fixture",
    2,
    transport,
    now,
  );
  assert.equal(result.id, stored.id);
  assert.equal(calls, 1);
  const unsafe = fixture();
  unsafe.payment.disputed = true;
  await assert.rejects(
    dispatchRefund(unsafe, "order_fixture", 1, transport, now),
  );
  assert.equal(calls, 1);
});
const fixture = () => ({
  order: {
    amount: 1000,
    currency: "usd",
    livemode: true,
    paymentIntent: "pi_fixture",
    status: "paid",
  },
  request: {
    id: "request_fixture",
    amount: 400,
    firstAttemptAt: new Date(now - 1000).toISOString(),
    stripeRefundId: null,
  },
  payment: {
    id: "pi_fixture",
    amountReceived: 1000,
    currency: "usd",
    livemode: true,
    status: "succeeded",
    disputed: false,
  },
  refunds: [],
  hasMore: false,
  knownRequestIds: ["request_fixture", "other_request"],
});
const refund = (
  id = "re_existing",
  requestId = "request_fixture",
  amount = 400,
  status = "succeeded",
) => ({
  id,
  requestId,
  amount,
  status,
  paymentIntent: "pi_fixture",
  currency: "usd",
});
test("refunds use remaining captured money, matching environment and an original payment", () => {
  assert.equal(refundDecision(fixture(), now).action, "create");
  for (const change of [
    (x) => (x.order.status = "pending"),
    (x) => (x.payment.livemode = false),
    (x) => (x.payment.currency = "eur"),
    (x) => (x.payment.id = "pi_other"),
    (x) => (x.payment.amountReceived = 900),
    (x) => (x.payment.disputed = true),
    (x) => (x.request.amount = 1001),
    (x) => (x.request.amount = -1),
  ]) {
    const x = fixture();
    change(x);
    assert.equal(refundDecision(x, now).action, "review");
  }
  const x = fixture();
  x.refunds = [refund("re_partial", "other_request", 700)];
  assert.equal(refundDecision(x, now).action, "review");
});
test("a known upstream refund is reconciled instead of created again, including after retention", () => {
  const x = fixture();
  x.refunds = [refund()];
  x.request.firstAttemptAt = new Date(now - 48 * 3600000).toISOString();
  assert.equal(refundDecision(x, now).action, "reconcile");
  x.refunds.push(refund("re_duplicate"));
  assert.equal(refundDecision(x, now).action, "review");
});
test("uncertain, externally issued, inconsistent or old attempts never create another monetary effect", () => {
  for (const change of [
    (x) => (x.hasMore = true),
    (x) => (x.request.stripeRefundId = "re_missing"),
    (x) =>
      (x.request.firstAttemptAt = new Date(now - 23 * 3600000).toISOString()),
    (x) => (x.refunds = [refund("re_external", null, 100)]),
    (x) => (x.refunds = [refund("re_bad", "request_fixture", 401)]),
  ]) {
    const x = fixture();
    change(x);
    assert.equal(refundDecision(x, now).action, "review");
  }
  const x = fixture();
  x.refunds = [refund("re_failed", "other_request", 700, "failed")];
  assert.equal(refundDecision(x, now).action, "create");
});
