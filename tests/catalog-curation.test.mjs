import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  curateCatalog,
  connectivityMode,
  isCommerciallyAllowed,
} from "../src/lib/catalog-curation.ts";
const make = (id, gb, days, extra = {}) => ({
  id,
  name: `Exact ${id}`,
  allowance: `${gb}GB`,
  dataGb: gb,
  days,
  kind: "fixed",
  coverageCode: "JP",
  retailPriceCents: 1200,
  details: {
    dataGb: gb,
    days,
    coverage: ["JP"],
    technologies: ["4G"],
    activation: "network",
    topUp: "none",
    networks: [
      {
        countryCode: "JP",
        operators: [{ name: "Carrier A", technologies: ["4G"] }],
      },
    ],
  },
  ...extra,
});
const run = (plans, extra = {}) =>
  curateCatalog({
    plans,
    destinationCode: "JP",
    destinationType: "country",
    ...extra,
  });
const rule = (plan_id, extra = {}) => ({
  plan_id,
  visibility: "auto",
  commercial_category: null,
  recommendation_eligible: true,
  incident_block: false,
  main_priority: null,
  ...extra,
});
test("deterministic four real categories, unchanged retail prices and input order", () => {
  const plans = [
    make("JP_1_7", 1, 7),
    make("JP_3_15", 3, 15),
    make("JP_5_30", 5, 30),
    make("JP_10_30", 10, 30),
    make("JP_20_30", 20, 30),
    make("JP_50_30", 50, 30),
  ];
  const before = JSON.stringify(plans),
    result = run(plans);
  assert.deepEqual(
    result.modes[0].plans.map((x) => x.plan.id),
    ["JP_1_7", "JP_5_30", "JP_10_30", "JP_20_30"],
  );
  assert.deepEqual(result.modes, run([...plans].reverse()).modes);
  assert.equal(JSON.stringify(plans), before);
  assert.deepEqual(
    result.modes[0].plans.filter((p) => p.recommended).map((p) => p.category),
    ["essential"],
  );
});
test("mandatory eligibility cannot be bypassed by manual priority; no fake fourth plan", () => {
  const p = make("JP_5_30", 5, 30);
  const wrong = make("wrong", 10, 30, { coverageCode: "US" });
  const result = run(
    [
      p,
      wrong,
      make("zero", 1, 7, { retailPriceCents: 0 }),
      make("small", 0.1, 7),
      make("long", 20, 90),
    ],
    { overrides: [rule("wrong", { visibility: "show", main_priority: 1 })] },
  );
  assert.equal(result.modes[0].plans.length, 1);
  assert.equal(result.modes[0].plans[0].plan.id, p.id);
  assert.ok(
    result.decisions.some(
      (d) => d.planId === "wrong" && d.reason === "destination_mismatch",
    ),
  );
});
test("manual selection overrides automatic choice without changing money or bypassing blocks", () => {
  const a = make("JP_3_15", 3, 15),
    b = make("JP_5_30", 5, 30);
  const overrides = [
    rule(a.id, { main_priority: 1, recommendation_eligible: false }),
    rule(b.id, { incident_block: true }),
  ];
  const result = run([a, b], { overrides });
  assert.equal(result.modes[0].plans[0].plan.id, a.id);
  assert.equal(result.modes[0].plans[0].recommended, false);
  assert.equal(isCommerciallyAllowed(b.id, overrides), false);
  assert.equal(
    isCommerciallyAllowed(a.id, [rule(a.id, { visibility: "hide" })]),
    false,
  );
});
test("special modes require approval AND a real technical difference; suffix is not evidence", () => {
  const a = make("JP_5_30", 5, 30),
    b = make("JP_5_30_IIJ", 5, 30);
  assert.equal(run([a, b]).modes.length, 1);
  assert.equal(
    run([a, b], { approvedModes: ["standard", "iij"] }).modes.length,
    1,
  );
  const evidence = {
    [a.id]: { packageCode: "a", breakoutIp: "HK", source: "audit" },
    [b.id]: { packageCode: "b", breakoutIp: "JP", source: "audit" },
  };
  const c = run([a, b], { approvedModes: ["standard", "iij"], evidence });
  assert.equal(c.modes.length, 2);
  assert.equal(c.modes[1].label.es, "IP local");
  assert.equal(connectivityMode(b), "iij");
});
test("equal allowances/durations do not repeat and price serves only as final candidate comparison", () => {
  const result = run([
    make("a", 5, 30, { retailPriceCents: 1300 }),
    make("b", 5, 30, { retailPriceCents: 1200 }),
  ]);
  assert.equal(result.modes[0].plans.length, 1);
  assert.equal(result.modes[0].plans[0].plan.id, "b");
  assert.equal(result.modes[0].plans[0].plan.retailPriceCents, 1200);
});
test("approval validates every special SKU and does not mislabel an IP-only difference as different networks", () => {
  const a = make("JP_5_30", 5, 30),
    b = make("JP_5_30_nonhkip", 5, 30),
    c = make("JP_10_30", 10, 30),
    d = make("JP_10_30_nonhkip", 10, 30);
  const evidence = {
    [a.id]: { packageCode: "a", breakoutIp: "HK", source: "audit" },
    [b.id]: { packageCode: "b", breakoutIp: "SG", source: "audit" },
  };
  const result = run([a, b, c, d], {
    approvedModes: ["standard", "nonhkip"],
    evidence,
  });
  assert.deepEqual(
    result.modes[1].plans.map((x) => x.plan.id),
    [b.id],
  );
  assert.equal(result.modes[1].label.es, "Otra conexión");
  assert.doesNotMatch(result.modes[1].description.es, /operadores diferente/);
  const onlyAlternative = run([a, b], {
    approvedModes: ["nonhkip"],
    evidence,
    overrides: [rule(a.id, { visibility: "hide" })],
  });
  assert.equal(onlyAlternative.modes[0].plans[0].plan.id, b.id);
});
test("long stays remain separate and 31-day ordinary packages need no fictitious 30-day replacement", () => {
  const a = make("JP_20_90", 20, 90);
  const result = run([make("JP_10_31", 10, 31), a]);
  assert.equal(result.modes[0].plans[0].plan.days, 31);
  assert.equal(result.modes[0].secondaryPlans[0].id, a.id);
});
test("every local selected SKU belongs to its destination and all retail cents are preserved", () => {
  const json = (p) => JSON.parse(readFileSync(p, "utf8"));
  const catalog = json("src/data/plans.json"),
    details = json("src/data/plan-details.json"),
    prices = json("src/data/retail-prices.json");
  for (const d of json("src/data/destinations.json")) {
    const plans = (catalog[d.slug] ?? []).map((p) => ({
      ...p,
      details: details[p.id],
      retailPriceCents: prices[p.id],
    }));
    const result = curateCatalog({
      plans,
      destinationCode: d.code,
      destinationType: d.type,
    });
    for (const mode of result.modes) {
      assert.ok(mode.plans.length <= 4);
      for (const p of mode.plans) {
        assert.ok(plans.some((x) => x.id === p.plan.id));
        assert.equal(p.plan.retailPriceCents, prices[p.plan.id]);
        assert.equal(p.plan.coverageCode, d.code);
      }
      for (const p of mode.secondaryPlans) {
        assert.ok(plans.some((x) => x.id === p.id));
        assert.equal(p.retailPriceCents, prices[p.id]);
        assert.equal(p.coverageCode, d.code);
      }
    }
  }
});
