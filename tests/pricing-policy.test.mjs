import test from "node:test";
import assert from "node:assert/strict";
import { priceProposal } from "../scripts/lib/pricing-policy.mjs";
const now = Date.parse("2026-10-27T12:00:00Z");
const plan = {
  baseCents: 1000,
  wholesaleUnits: 40000,
  costCheckedAt: now,
  market: { ceilingCents: 1500, equivalent: true, checkedAt: now },
};
const config = {
  upliftBps: 1200,
  minContributionBps: 2000,
  lowPriceThresholdCents: 500,
  maxLowPriceIncreaseBps: 2000,
  maxEvidenceAgeMs: 86400000,
  affiliateBps: 800,
  feeBps: 440,
  fixedFeeCents: 30,
  maxDiscountBps: 1000,
  otherUnitCostUnits: 0,
};
test("12% rounds upward to whole dollars and respects a noninteger market ceiling", () => {
  assert.equal(priceProposal(plan, config, now).proposedCents, 1200);
  assert.equal(
    priceProposal(
      { ...plan, market: { ...plan.market, ceilingCents: 1199 } },
      config,
      now,
    ).proposedCents,
    1100,
  );
});
test("low-price rounding cannot turn a nominal 12% into a 33% increase", () => {
  assert.equal(
    priceProposal({ ...plan, baseCents: 300 }, config, now).reason,
    "low_price_cap",
  );
  assert.equal(
    priceProposal({ ...plan, baseCents: 400 }, config, now).reason,
    "low_price_cap",
  );
  assert.equal(
    priceProposal(
      { ...plan, baseCents: 500, wholesaleUnits: 10000 },
      config,
      now,
    ).proposedCents,
    600,
  );
});
test("contribution is 20% of the discounted amount collected after conservative fees", () => {
  const r = priceProposal(plan, config, now);
  assert.equal(r.status, "eligible");
  assert.equal(r.chargedCents, 1080);
  assert.equal(
    priceProposal({ ...plan, wholesaleUnits: 100000 }, config, now).reason,
    "contribution_below_floor",
  );
  const exact = {
    ...config,
    maxDiscountBps: 0,
    feeBps: 0,
    affiliateBps: 0,
    fixedFeeCents: 0,
  };
  assert.equal(
    priceProposal({ ...plan, wholesaleUnits: 96000 }, exact, now).status,
    "eligible",
  );
  assert.equal(
    priceProposal({ ...plan, wholesaleUnits: 96001 }, exact, now).reason,
    "contribution_below_floor",
  );
});
test("unknown fees, missing or non-equivalent market evidence and stale costs fail closed", () => {
  assert.equal(
    priceProposal(plan, { ...config, feeBps: null }, now).reason,
    "missing_cost_assumptions",
  );
  assert.equal(
    priceProposal({ ...plan, market: null }, config, now).reason,
    "market_unverified",
  );
  assert.equal(
    priceProposal(
      { ...plan, market: { ...plan.market, equivalent: false } },
      config,
      now,
    ).reason,
    "market_unverified",
  );
  assert.equal(
    priceProposal({ ...plan, costCheckedAt: now - 86400001 }, config, now)
      .reason,
    "stale_wholesale",
  );
  assert.equal(
    priceProposal(
      { ...plan, market: { ...plan.market, checkedAt: now - 86400001 } },
      config,
      now,
    ).reason,
    "market_unverified",
  );
});
test("never cuts a price or reraises from already updated prices through repeat application", () => {
  assert.equal(
    priceProposal(
      { ...plan, market: { ...plan.market, ceilingCents: 900 } },
      config,
      now,
    ).reason,
    "market_below_current",
  );
  assert.equal(
    priceProposal({ ...plan, baseCents: 1200, anchorCents: 1000 }, config, now)
      .reason,
    "already_at_target",
  );
  assert.throws(() =>
    priceProposal(plan, { ...config, maxDiscountBps: 10000 }, now),
  );
});

test("owner fee budget includes 8% affiliate and 5% maximum discount", () => {
  const r = priceProposal(plan, { ...config, maxDiscountBps: 500 }, now);
  assert.equal(r.chargedCents, 1140);
  assert.equal(r.contributionBps, 4988);
});
