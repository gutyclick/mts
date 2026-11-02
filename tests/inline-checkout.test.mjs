import test from "node:test";
import assert from "node:assert/strict";
import { confirmPreparedPayment } from "../src/lib/payments/confirm-prepared-payment.ts";
function fixture(session) {
  let calls = [];
  return {
    calls,
    sdk: {
      loadActions: async () => ({
        type: "success",
        actions: {
          getSession: () => session,
          confirm: async (payload) => {
            calls.push(payload);
            return { type: "success" };
          },
        },
      }),
    },
  };
}
const expected = { live: true, currency: "JPY", total: 2500 };
const session = {
  livemode: true,
  currency: "jpy",
  total: { total: { minorUnitsAmount: 2500 } },
};
test("collected payment method confirms the server session without changing its total or currency", async () => {
  const f = fixture(session);
  await confirmPreparedPayment(f.sdk, expected, "pm_example");
  assert.deepEqual(f.calls, [{ paymentMethod: "pm_example" }]);
});
test("environment, currency and amount mismatches never call Stripe confirmation", async () => {
  for (const s of [
    { ...session, livemode: false },
    { ...session, currency: "usd" },
    { ...session, total: { total: { minorUnitsAmount: 25 } } },
  ]) {
    const f = fixture(s);
    await assert.rejects(confirmPreparedPayment(f.sdk, expected, "pm_example"));
    assert.equal(f.calls.length, 0);
  }
});
test("failed initialization and malformed collected methods cannot confirm", async () => {
  const f = fixture(session);
  await assert.rejects(confirmPreparedPayment(f.sdk, expected, "arbitrary"));
  assert.equal(f.calls.length, 0);
  await assert.rejects(
    confirmPreparedPayment(
      { loadActions: async () => ({ type: "error" }) },
      expected,
      "pm_example",
    ),
  );
});
