import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import catalog from "../src/data/plans.json" with { type: "json" };
import { destinations, searchDestinations } from "../src/lib/catalog.ts";
import { filterPlans, type Plan } from "../src/lib/plan-utils.ts";
import {
  equivalentPath,
  pathFor,
  locales,
  routeSegments,
} from "../src/lib/i18n.ts";
import { helpContent } from "../src/lib/help-content.ts";
const plansByDestination = catalog as Record<string, Plan[]>;
test("search accepts localized names, aliases, corrected source names and codes", () => {
  for (const query of ["JAPÓN", " japon ", "Japan", "Tokio", "JP"])
    assert.equal(searchDestinations(query)[0]?.slug, "japan");
  for (const query of ["EEUU", "USA", "Estados Unidos", "United"])
    assert.equal(searchDestinations(query)[0]?.slug, "united-states");
  for (const query of ["Reino Unido", "UK", "GB"])
    assert.equal(searchDestinations(query)[0]?.slug, "united-kingdom");
  assert.equal(searchDestinations("Cayman lslands")[0]?.code, "KY");
  assert.equal(searchDestinations("Philippine")[0]?.code, "PH");
  assert.equal(searchDestinations("unlikely-place").length, 0);
  assert.equal(searchDestinations(" ").length, 244);
});
test("all source plans are retained once, organized and allowlisted without prices", () => {
  assert.equal(destinations.length, 244);
  assert.equal(destinations.filter((d) => d.type === "country").length, 202);
  assert.equal(destinations.filter((d) => d.type === "region").length, 42);
  const ids = new Set<string>();
  for (const destination of destinations) {
    const plans = plansByDestination[destination.slug];
    assert.equal(plans.length, destination.planCount);
    assert.ok(plans.length > 0);
    assert.ok(existsSync(`public${destination.image}`));
    for (const plan of plans) {
      assert.deepEqual(
        Object.keys(plan).sort(),
        [
          "id",
          "name",
          "allowance",
          "dataGb",
          "days",
          "kind",
          "coverageCode",
        ].sort(),
      );
      assert.ok(!ids.has(plan.id));
      ids.add(plan.id);
      assert.ok(plan.name && plan.dataGb > 0 && plan.days > 0);
      assert.ok(["fixed", "daily"].includes(plan.kind));
      if (destination.type === "country")
        assert.equal(plan.coverageCode, destination.code);
    }
  }
  assert.equal(ids.size, 3186);
  assert.equal(plansByDestination.japan.length, 43);
  for (const slug of ["japan", "united-states", "france", "italy"])
    assert.equal(
      destinations.find((d) => d.slug === slug)?.artworkKind,
      "banner",
    );
});
test("real catalog filters intersect allowance, duration and daily/fixed type", () => {
  const plans = plansByDestination.japan;
  assert.equal(filterPlans(plans, "", "").length, 43);
  const matching = filterPlans(plans, "1", "1", "daily");
  assert.ok(matching.length > 0);
  assert.ok(
    matching.every((p) => p.dataGb === 1 && p.days === 1 && p.kind === "daily"),
  );
  assert.equal(filterPlans(plans, "50", "1").length, 0);
  assert.ok(plans.some((p) => p.allowance === "100MB" && p.dataGb === 0.1));
});
test("language switching preserves informational routes and destinations", () => {
  for (const locale of locales)
    for (const key of Object.keys(
      routeSegments,
    ) as (keyof typeof routeSegments)[]) {
      const other = locale === "en" ? "es" : "en";
      assert.equal(
        equivalentPath(pathFor(locale, key), other),
        pathFor(other, key),
      );
    }
  assert.equal(
    equivalentPath("/en/esim/united-states", "es"),
    "/es/esim/united-states",
  );
  assert.equal(pathFor("en"), "/en");
  for (const locale of locales)
    assert.equal(
      helpContent[locale].categories.flatMap((c) => c.questions).length,
      24,
    );
});
