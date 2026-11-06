import test from "node:test";
import assert from "node:assert/strict";
import {
  auditContribution as audit,
  minimumWholeUsd as floor,
} from "../scripts/lib/profitability-audit.mjs";
const base = {
  feeBps: 540,
  fixedFeeUnits: 3000,
  radarUnits: 500,
  minContributionBps: 2000,
};
test("includes separately billed Radar and rounds payment fees conservatively", () => {
  const r = audit(8900, 659200, base);
  assert.equal(r.feeUnits, 51600);
  assert.equal(r.contributionUnits, 179200);
  assert.equal(r.marginBps, 2013);
  assert.equal(r.meetsFloor, true);
  assert.equal(audit(8800, 659200, base).meetsFloor, false);
});
test("redemption reduces cash once; only paid cash earns rounded-down rewards", () => {
  const r = audit(2000, 50000, {
    ...base,
    feeBps: 0,
    fixedFeeUnits: 0,
    radarUnits: 0,
    redeemBps: 500,
    earnBps: 600,
  });
  assert.equal(r.chargedCents, 1900);
  assert.equal(r.earnedCoins, 114);
  assert.equal(r.contributionUnits, 128600);
  assert.throws(() =>
    audit(2000, 50000, { ...base, discountBps: 500, redeemBps: 500 }),
  );
});
test("whole-dollar floors meet exact 20% and the previous dollar fails", () => {
  for (const cost of [3000, 659200, 2199200])
    for (const extra of [
      {},
      { discountBps: 500, affiliateBps: 800 },
      { redeemBps: 500, earnBps: 600, affiliateBps: 800 },
    ]) {
      const s = { ...base, ...extra },
        n = floor(cost, s);
      assert.ok(audit(n * 100, cost, s).meetsFloor);
      if (n > 1) assert.equal(audit((n - 1) * 100, cost, s).meetsFloor, false);
    }
});
test("reports losses independently of failing the target, rejecting invalid units", () => {
  assert.equal(audit(100, 10000, base).loss, true);
  assert.throws(() => audit(100.5, 10000, base));
  assert.throws(() => audit(100, NaN, base));
});
