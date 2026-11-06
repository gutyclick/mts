import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPlanFamilies,
  availableDurationOptions,
  availableVariantOptions,
  resolvePlanSelection,
  selectDefaultPlan,
} from "../src/lib/plan-selection.ts";

function plan(id, dataGb, days, retailPriceCents = 1000) {
  return {
    id,
    dataGb,
    days,
    retailPriceCents,
    kind: "fixed",
    name: id,
    allowance: `${dataGb} GB`,
    coverageCode: "JP",
    details: {
      dataGb,
      days,
      coverage: ["JP"],
      technologies: ["4G"],
      activation: "network",
      topUp: "none",
      networks: [],
    },
  };
}
const japan = [
  plan("jp3_7", 3, 7),
  plan("jp3_15", 3, 15, 1500),
  plan("jp10_30", 10, 30, 3000),
  plan("jp3_premium_15", 3, 15, 1700),
];

test("durations and variants require exact capacity and real SKUs", () => {
  assert.deepEqual(availableDurationOptions(japan, 3), [7, 15]);
  assert.deepEqual(availableDurationOptions(japan, 10), [30]);
  assert.deepEqual(availableVariantOptions(japan, 3, 15), [
    { id: "standard" },
    { id: "premium" },
  ]);
  assert.deepEqual(availableVariantOptions(japan, 3, 7), [{ id: "standard" }]);
  assert.equal(
    resolvePlanSelection(japan, { dataGb: 10, days: 15 }),
    undefined,
  );
  assert.equal(
    resolvePlanSelection(japan, { dataGb: 3, days: 7, mode: "premium" }),
    undefined,
  );
  assert.equal(
    resolvePlanSelection(japan, { dataGb: 3, days: 15, mode: "premium" }).id,
    "jp3_premium_15",
  );
});

test("families preserve small and long stays and registered starting prices", () => {
  const result = buildPlanFamilies([
    ...japan,
    plan("small", 0.5, 1, 200),
    plan("long", 10, 180, 8000),
  ]);
  assert.deepEqual(
    result.map((f) => f.dataGb),
    [0.5, 3, 10],
  );
  assert.equal(result[1].minDays, 7);
  assert.equal(result[1].minPriceCents, 1000);
  assert.equal(result[2].plans.at(-1).days, 180);
});

test("same selection resolves by registered price then id independent of input order", () => {
  const plans = [
    plan("z", 3, 7, 700),
    plan("a", 3, 7, 700),
    plan("b", 3, 7, 800),
  ];
  assert.equal(resolvePlanSelection(plans, { dataGb: 3 }).id, "a");
  assert.equal(
    resolvePlanSelection([...plans].reverse(), { dataGb: 3 }).id,
    "a",
  );
  assert.equal(resolvePlanSelection(plans, { dataGb: 3, planId: "b" }).id, "b");
});

test("deep links preserve matching IDs and cannot override capacity duration or mode", () => {
  assert.equal(selectDefaultPlan(japan, "jp3_premium_15").id, "jp3_premium_15");
  assert.equal(selectDefaultPlan(japan, "unknown").id, "jp3_7");
  assert.equal(selectDefaultPlan(japan, "jp3_premium_15", 7).id, "jp3_7");
  assert.equal(
    resolvePlanSelection(japan, { dataGb: 10, days: 15, planId: "jp3_15" }),
    undefined,
  );
  assert.equal(
    resolvePlanSelection(japan, {
      dataGb: 3,
      days: 15,
      mode: "standard",
      planId: "jp3_premium_15",
    }).id,
    "jp3_15",
  );
});

test("requested initial duration selects the smallest standard capacity that offers it", () => {
  const plans = [
    plan("one7", 1, 7),
    plan("one_premium_15", 1, 15),
    plan("three15", 3, 15),
    plan("five15", 5, 15),
    plan("ten30", 10, 30),
  ];
  assert.equal(selectDefaultPlan(plans, undefined, 15).id, "three15");
  assert.equal(selectDefaultPlan(plans, "one7", 15).id, "three15");
  assert.equal(selectDefaultPlan(plans, undefined, 14).id, "one7");
  assert.equal(
    selectDefaultPlan([...plans].reverse(), undefined, 15).id,
    "three15",
  );
});

test("invalid entries are ignored and inputs remain unchanged", () => {
  const invalid = [
    null,
    { ...plan("missing", 3, 7), retailPriceCents: undefined },
    plan("zero", 3, 7, 0),
    plan("decimal", 3, 7, 1.5),
    { ...plan("wrong", 3, 7), details: { dataGb: 10, days: 7 } },
    { ...plan("other", 3, 7), kind: "unlimited" },
  ];
  const input = [...japan, ...invalid];
  const before = structuredClone(input);
  assert.equal(buildPlanFamilies(input).length, 2);
  assert.deepEqual(input, before);
  assert.equal(selectDefaultPlan(invalid), undefined);
  assert.deepEqual(availableDurationOptions(invalid, 3), []);
});
