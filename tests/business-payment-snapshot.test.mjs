import test from "node:test";
import assert from "node:assert/strict";
import { verifyBusinessStripePayment } from "../src/lib/portal/payment-snapshot.ts";
const a = {
  id: "attempt",
  order_id: "order",
  method: "stripe",
  livemode: false,
  provider_ref: "attempt",
  session_id: "cs_test_fixture",
  expected_amount_cents: 3000,
};
const s = {
  id: a.session_id,
  livemode: false,
  currency: "usd",
  amount_total: 3000,
  metadata: { mts_b2b_order_id: "order", mts_b2b_attempt_id: "attempt" },
  payment_status: "paid",
  status: "complete",
};
test("only exact verified B2B provider snapshots can settle payment", () => {
  assert.equal(verifyBusinessStripePayment(a, s), "succeeded");
  for (const patch of [
    { id: "other" },
    { livemode: true },
    { currency: "eur" },
    { amount_total: 2999 },
    { metadata: { mts_b2b_order_id: "other", mts_b2b_attempt_id: "attempt" } },
    { metadata: null },
  ])
    assert.throws(() => verifyBusinessStripePayment(a, { ...s, ...patch }));
});
test("browser return and unpaid completed sessions never prove payment", () => {
  assert.equal(
    verifyBusinessStripePayment(a, { ...s, payment_status: "unpaid" }),
    "pending",
  );
  assert.equal(
    verifyBusinessStripePayment(a, {
      ...s,
      payment_status: "unpaid",
      status: "expired",
    }),
    "cancelled",
  );
});
