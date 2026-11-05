import test from "node:test";
import assert from "node:assert/strict";
import { quoteTotals, canRelease } from "../src/lib/portal/commercial-core.ts";

const base = {
  unitCents: 1000,
  quantity: 3,
  taxCents: 210,
  wholesaleUnitUnits: 30000,
  feeBps: 290,
  fixedFeeCents: 30,
};
test("fees apply once per order and taxes do not count toward contribution", () => {
  assert.deepEqual(quoteTotals(base), {
    subtotalCents: 3000,
    taxCents: 210,
    totalCents: 3210,
    feeUnits: 12309,
    wholesaleUnits: 90000,
    contributionUnits: 197691,
    contributionBps: 6589,
    eligible: true,
  });
});
test("fees round upward in subcent units and margin gates use exact ratios", () => {
  const q = quoteTotals({
    ...base,
    quantity: 1,
    taxCents: 1,
    feeBps: 1,
    fixedFeeCents: 0,
  });
  assert.equal(q.feeUnits, 11);
  assert.equal(
    quoteTotals({ ...base, wholesaleUnitUnits: 90000 }).eligible,
    false,
  );
  assert.equal(
    quoteTotals({ ...base, otherReserveCents: 2000 }).eligible,
    false,
  );
});
test("rejects invalid numbers and unsafe output arithmetic", () => {
  for (const patch of [
    { unitCents: 101 },
    { quantity: 0 },
    { quantity: 10001 },
    { taxCents: -1 },
    { feeBps: 1.1 },
    { wholesaleUnitUnits: NaN },
    { fixedFeeCents: Infinity },
    { taxCents: Number.MAX_SAFE_INTEGER },
    { wholesaleUnitUnits: Number.MAX_SAFE_INTEGER },
  ])
    assert.throws(() => quoteTotals({ ...base, ...patch }));
});
test("initial release requires paid awaiting-release order with no units issued", () => {
  const ready = {
    paymentStatus: "paid",
    orderStatus: "awaiting_release",
    readyUnits: 0,
    totalUnits: 3,
  };
  assert.equal(canRelease(ready), true);
  for (const patch of [
    { paymentStatus: "pending" },
    { paymentStatus: "failed" },
    { paymentStatus: "refunded" },
    { orderStatus: "released" },
    { refunded: true },
    { readyUnits: 2 },
    { readyUnits: 4 },
    { totalUnits: 0 },
    { readyUnits: NaN },
  ])
    assert.equal(canRelease({ ...ready, ...patch }), false);
});
