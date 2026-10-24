import { test } from "node:test";
import assert from "node:assert/strict";
import {
  destinations,
  searchDestinations,
  getPlans,
  filterPlans,
} from "../src/lib/catalog.ts";
import { equivalentPath, pathFor } from "../src/lib/i18n.ts";

test("search accepts Spanish accents, English, aliases and whitespace", () => {
  for (const query of ["JAPÓN", " japon ", "Japan", "Tokio"])
    assert.equal(searchDestinations(query)[0]?.slug, "japan");
  for (const query of ["EEUU", "USA", "Estados Unidos"])
    assert.equal(searchDestinations(query)[0]?.slug, "united-states");
  assert.equal(searchDestinations("Reino Unido")[0]?.slug, "united-kingdom");
  assert.equal(searchDestinations("UK")[0]?.slug, "united-kingdom");
  assert.equal(searchDestinations("unlikely-place").length, 0);
  assert.equal(searchDestinations(" ").length, 6);
});
test("language switching preserves all equivalent pages and destinations", () => {
  assert.equal(equivalentPath("/en/how-it-works", "es"), "/es/como-funciona");
  assert.equal(equivalentPath("/es/compatibilidad", "en"), "/en/compatibility");
  assert.equal(
    equivalentPath("/en/esim/united-states", "es"),
    "/es/esim/united-states",
  );
  assert.equal(equivalentPath("/es/privacidad", "en"), "/en/privacy");
  assert.equal(pathFor("en"), "/en");
});
test("plan filters intersect data and duration and expose an empty state", () => {
  const plans = getPlans(destinations[0]);
  assert.equal(filterPlans(plans, "", "").length, 4);
  assert.equal(filterPlans(plans, "5", "30").length, 1);
  assert.equal(filterPlans(plans, "1", "30").length, 0);
  assert.equal(filterPlans(plans, "", "30").length, 2);
});
test("every price is explicitly mock and no unverified provider fields are populated", () => {
  for (const destination of destinations) {
    const plans = getPlans(destination);
    assert.equal(
      Math.min(...plans.map((plan) => plan.priceUsd)),
      destination.startingPrice,
    );
    for (const plan of plans) {
      assert.equal(plan.source, "mock");
      assert.equal(plan.network, null);
      assert.equal(plan.activation, null);
      assert.equal(plan.topUp, null);
      assert.ok(plan.priceUsd > 0 && plan.dataGb > 0);
    }
  }
});
