import test from "node:test";
import assert from "node:assert/strict";
import {
  commercialKey,
  coherencePairs,
  suggestedMinimum,
} from "../scripts/lib/price-coherence.mjs";
const plan = (id, gb, days, price, apn = "wbdata") => ({
  id,
  destinationSlug: "brazil",
  dataGb: gb,
  days,
  retailPriceCents: price,
  details: { apn, activation: "network", coverage: ["BR"] },
});
const key = (p) => commercialKey(p, "standard");
test("detects equal duration prices previously missed; Brazil minimum is ten dollars", () => {
  const [pair] = coherencePairs(
    [plan("a", 3, 15, 800), plan("b", 3, 30, 800)],
    key,
  );
  assert.equal(pair.flagged, true);
  assert.equal(pair.type, "DURACION");
  assert.equal(suggestedMinimum(pair.a, pair.b, pair.type, 800), 1000);
});
test("compares capacity ties and inverted duration prices; excludes service differences", () => {
  assert.equal(
    coherencePairs([plan("a", 0.5, 7, 300), plan("b", 1, 7, 300)], key)[0]
      .flagged,
    true,
  );
  assert.equal(
    coherencePairs([plan("a", 3, 15, 800), plan("b", 3, 30, 600)], key)[0]
      .flagged,
    true,
  );
  assert.equal(
    coherencePairs([plan("a", 3, 15, 800), plan("b", 3, 30, 800, "other")], key)
      .length,
    0,
  );
});
test("premium rounds to whole dollars and capacity requires only one dollar increment", () => {
  assert.equal(
    suggestedMinimum({ days: 15 }, { days: 30 }, "DURACION", 1300),
    1700,
  );
  assert.equal(suggestedMinimum({}, {}, "CAPACIDAD", 300), 400);
});

test("3GB/30d cannot exceed 10GB/30d; also catches dominance across both dimensions", () => {
  assert.equal(
    coherencePairs([plan("a", 3, 30, 1200), plan("b", 10, 30, 1100)], key)[0]
      .flagged,
    true,
  );
  const [pair] = coherencePairs(
    [plan("a", 3, 15, 1200), plan("b", 10, 30, 1100)],
    key,
  );
  assert.equal(pair.type, "CAPACIDAD_Y_DURACION");
  assert.equal(pair.flagged, true);
  // More GB but fewer days is a tradeoff, not a dominance violation.
  assert.equal(
    coherencePairs([plan("a", 3, 30, 1200), plan("b", 10, 7, 1100)], key)
      .length,
    0,
  );
});
