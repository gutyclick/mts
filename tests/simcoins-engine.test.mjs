import test from "node:test";
import assert from "node:assert/strict";
import {
  earnedCoins,
  levelForSpend,
  buildSimcoinsQuote,
  proportionalRefundCoins,
  usdStringToCents,
} from "../src/lib/simcoins/engine.ts";
import {
  defaultSimcoinsLevels,
  defaultSimcoinsSettings,
  simcoinsFlags,
} from "../src/lib/simcoins/config.ts";
const now = Date.parse("2026-10-27T12:00:00Z");
const line = (overrides = {}) => ({
  planId: "JP_10_30",
  quantity: 1,
  grossUnitCents: 2000,
  wholesaleUnitUnits: 50000,
  costObservedAt: new Date(now).toISOString(),
  earnEnabled: true,
  redeemEnabled: true,
  ...overrides,
});
const quote = (extra = {}) =>
  buildSimcoinsQuote({
    lines: [line()],
    currency: "USD",
    availableCoins: 10000,
    requestedCoins: 0,
    eligibleSpendCents: 1,
    settings: defaultSimcoinsSettings,
    levels: defaultSimcoinsLevels,
    nowMs: now,
    ...extra,
  });
test("flags default off and initial traveler earns zero; tier changes apply after purchase", () => {
  assert.equal(simcoinsFlags({}).enabled, false);
  assert.equal(
    simcoinsFlags({ SIMCOINS_EARN_ENABLED: "true" }).earnEnabled,
    false,
  );
  assert.equal(levelForSpend(0).id, "traveler");
  assert.equal(levelForSpend(1).id, "explorer");
  assert.equal(levelForSpend(6000).id, "adventurer");
  assert.equal(levelForSpend(12500).id, "globetrotter");
  assert.equal(levelForSpend(30000).id, "legend");
  const first = quote({ eligibleSpendCents: 0 });
  assert.equal(first.earnedCoins, 0);
  assert.equal(first.eligibleSpendCents, 2000);
  assert.equal(first.levelId, "traveler");
  assert.equal(quote({ eligibleSpendCents: 5900 }).rateBps, 300);
  assert.equal(levelForSpend(7900).rateBps, 400);
});
test("cashback uses exact cents and rounds whole coins down", () => {
  assert.equal(earnedCoins(2000, 300), 60);
  assert.equal(earnedCoins(4000, 400), 160);
  assert.equal(earnedCoins(6000, 500), 300);
  assert.equal(earnedCoins(6000, 600), 360);
  assert.equal(earnedCoins(1999, 300), 59);
  assert.equal(usdStringToCents("19.99"), 1999);
  assert.throws(() => usdStringToCents("1.001"));
  assert.throws(() => earnedCoins(1.5, 300));
});
test("tax, promotions and redeemed coins are excluded from earning and redemptions do not stack with promotions", () => {
  const discounted = quote({
    lines: [
      line({
        grossUnitCents: 2200,
        taxUnitCents: 200,
        promotionUnitCents: 100,
      }),
    ],
    requestedCoins: 100,
  });
  assert.equal(discounted.redeemedCoins, 0);
  assert.equal(discounted.earnedCoins, 57);
  const redeemed = quote({ requestedCoins: 100 });
  assert.equal(redeemed.redeemedCoins, 100);
  assert.equal(redeemed.netCents, 1900);
  assert.equal(redeemed.earnedCoins, 57);
  assert.equal(redeemed.maxRedeemCoins, 100);
  assert.ok(redeemed.contributionUnits > 0);
});
test("available balance, five-percent limit and quantity allocations bound redemption", () => {
  assert.equal(
    quote({ availableCoins: 20, requestedCoins: 999 }).redeemedCoins,
    20,
  );
  assert.equal(quote({ requestedCoins: 99999 }).redeemedCoins, 100);
  const q = quote({ lines: [line({ quantity: 3 })], requestedCoins: 101 });
  assert.equal(q.redeemedCoins, 99);
  assert.equal(q.lines[0].redeemUnitCoins, 33);
  assert.equal(
    q.units.reduce((s, u) => s + u.fixedFeeUnits, 0),
    3000,
  );
  assert.equal(q.earnedCoins, Math.floor(((6000 - 99) * 300) / 10000));
  assert.equal(
    q.units.reduce((s, u) => s + u.earnedCoins, 0),
    q.earnedCoins,
  );
});
test("cost freshness, opt-ins and insufficient contribution fail closed without changing retail prices", () => {
  for (const l of [
    line({ wholesaleUnitUnits: null }),
    line({ costObservedAt: "2026-01-01T00:00:00Z" }),
    line({ earnEnabled: false, redeemEnabled: false }),
    line({ wholesaleUnitUnits: 190000 }),
  ]) {
    const q = quote({ lines: [l], requestedCoins: 100 });
    assert.equal(q.earnedCoins, 0);
    assert.equal(q.redeemedCoins, 0);
    assert.equal(q.eligibleSpendCents, 0);
    assert.ok(q.reason);
    assert.equal(q.grossCents, 2000);
  }
  const fx = quote({
    currency: "JPY",
    fxRate: "1500000000000",
    currencyDecimals: 0,
  });
  assert.ok(fx.contributionUnits < quote().contributionUnits);
});
test("duplicate product IDs and unsafe money are rejected; refunds are cumulative and exact at full refund", () => {
  assert.throws(() => quote({ lines: [line(), line()] }));
  assert.throws(() => quote({ requestedCoins: -1 }));
  assert.equal(proportionalRefundCoins(59, 500, 1999), 14);
  assert.equal(proportionalRefundCoins(59, 1999, 1999), 59);
  assert.throws(() => proportionalRefundCoins(59, 2000, 1999));
});

test("FX uses the actually rounded payment conservatively", () => {
  const missing = quote({ currency: "JPY" });
  assert.equal(missing.earnedCoins, 0);
  assert.equal(missing.reason, "unverified_fx");
  const q = quote({
    currency: "JPY",
    fxRate: "1500000000000",
    currencyDecimals: 0,
    lines: [line({ grossUnitCents: 1999 })],
  });
  assert.ok(q.units[0].paidCents <= 1999);
  assert.equal(q.eligibleSpendCents, q.units[0].paidCents);
  assert.equal(q.earnedCoins, earnedCoins(q.eligibleSpendCents, 300));
});
