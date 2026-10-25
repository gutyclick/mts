import test from "node:test";
import assert from "node:assert/strict";
import {
  buildStripeCatalog,
  syncStripeCatalog,
  testSecret,
  catalogCSV,
} from "../scripts/lib/stripe-catalog.mjs";

const destinations = [
  { slug: "united-states", name: { es: "Estados Unidos" } },
];
const plan = {
  id: "US_3_30_usip",
  name: "United States 3GB 30Days USIP",
  kind: "fixed",
  dataGb: 3,
  days: 30,
  retailPriceCents: 900,
  supplierCost: "PRIVATE",
};
const build = (p = plan) =>
  buildStripeCatalog(destinations, { "united-states": [p] });

test("explicit retail projection preserves variants, integer cents and stable identities", () => {
  const [row] = build();
  assert.match(row.name, /Estados Unidos · 3 GB · 30 días · USIP/);
  assert.equal(row.unitAmount, 900);
  assert.equal(row.variant, "USIP");
  assert.ok(!JSON.stringify(row).includes("PRIVATE"));
  assert.ok(!catalogCSV([row]).includes("supplierCost"));
  const [changed] = build({ ...plan, retailPriceCents: 1000 });
  assert.equal(row.productId, changed.productId);
  assert.notEqual(row.lookupKey, changed.lookupKey);
});
test("invalid prices, daily plans, duplicate identities and live keys are rejected", () => {
  for (const value of [0, -1, 2.5, undefined, NaN, 100000001])
    assert.throws(() => build({ ...plan, retailPriceCents: value }));
  assert.throws(() => build({ ...plan, kind: "daily" }));
  assert.throws(() =>
    buildStripeCatalog(destinations, { "united-states": [plan, plan] }),
  );
  assert.throws(() => testSecret("sk_live_" + "x".repeat(24)));
  assert.throws(() => testSecret("pk_test_" + "x".repeat(24)));
  assert.equal(
    testSecret("sk_test_" + "x".repeat(24)),
    "sk_test_" + "x".repeat(24),
  );
});

function mockStripe() {
  const products = new Map();
  const prices = new Map();
  let writes = 0;
  let fail = false;
  const stripe = {
    products: {
      async *list() {
        yield* products.values();
      },
      async create(data) {
        writes++;
        const p = { ...data, active: true, livemode: false };
        products.set(p.id, p);
        return p;
      },
      async update(id, data) {
        writes++;
        Object.assign(products.get(id), data);
        return products.get(id);
      },
    },
    prices: {
      async *list() {
        yield* prices.values();
      },
      async create(data) {
        if (fail) {
          fail = false;
          throw new Error("Network failure");
        }
        writes++;
        const p = {
          ...data,
          id: `price_${prices.size}`,
          type: "one_time",
          active: true,
          livemode: false,
        };
        prices.set(p.lookup_key, p);
        return p;
      },
    },
  };
  return {
    stripe,
    products,
    prices,
    writes: () => writes,
    failOnce: () => {
      fail = true;
    },
  };
}
test("reruns reuse products and prices; price changes create a new price only", async () => {
  const m = mockStripe();
  const first = await syncStripeCatalog(m.stripe, build());
  const count = m.writes();
  assert.deepEqual(await syncStripeCatalog(m.stripe, build()), first);
  assert.equal(m.writes(), count);
  const changed = await syncStripeCatalog(
    m.stripe,
    build({ ...plan, retailPriceCents: 1000 }),
  );
  assert.equal(m.products.size, 1);
  assert.equal(m.prices.size, 2);
  assert.notEqual(changed[0].priceId, first[0].priceId);
});
test("a partially completed import resumes without duplicating the product", async () => {
  const m = mockStripe();
  m.failOnce();
  await assert.rejects(syncStripeCatalog(m.stripe, build()));
  await syncStripeCatalog(m.stripe, build());
  assert.equal(m.products.size, 1);
  assert.equal(m.prices.size, 1);
});
test("conflicting price identity and live responses stop before writes", async () => {
  const m = mockStripe();
  await syncStripeCatalog(m.stripe, build());
  const price = [...m.prices.values()][0];
  price.unit_amount = 1;
  const count = m.writes();
  await assert.rejects(syncStripeCatalog(m.stripe, build()));
  assert.equal(m.writes(), count);
  price.livemode = true;
  await assert.rejects(syncStripeCatalog(m.stripe, build()));
  assert.equal(m.writes(), count);
});
