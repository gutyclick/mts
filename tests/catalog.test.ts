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
import { parseFAQVote } from "../src/lib/faq-feedback.ts";
import { experiencePath, planPath } from "../src/lib/experience-routes.ts";
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
      29,
    );
});

test("FAQ IDs survive translation and related articles reference existing questions", () => {
  const english = helpContent.en.categories.flatMap((c) => c.questions);
  const spanish = helpContent.es.categories.flatMap((c) => c.questions);
  assert.deepEqual(
    english.map((q) => q.id),
    spanish.map((q) => q.id),
  );
  const ids = new Set(english.map((q) => q.id));
  assert.equal(ids.size, english.length);
  for (const locale of locales)
    for (const category of helpContent[locale].categories)
      for (const q of category.questions) {
        assert.ok(q.question && q.answer);
        for (const text of [q.answer, q.note ?? "", ...(q.steps ?? [])])
          assert.ok(
            !text.includes("?"),
            `Unexpected replacement character in ${locale}/${q.id}`,
          );
        if (locale === "es") assert.match(q.question, /^(¿|Tengo)/);
        assert.match(q.id, /^[a-z]+(?:-[a-z]+)*$/);
        for (const related of q.related ?? []) {
          assert.ok(ids.has(related));
          assert.notEqual(related, q.id);
        }
        for (const link of q.links ?? [])
          assert.ok(new URL(link.href).protocol === "https:");
      }
  for (const value of [null, "unknown", "true", "{vote:helpful}", 1])
    assert.equal(parseFAQVote(value), null);
  assert.equal(parseFAQVote("helpful"), "helpful");
  assert.equal(parseFAQVote("more-help"), "more-help");
});

test("visual journey routes preserve translated pages and selected plan identity", () => {
  for (const [en, es] of [
    ["/en/my-esims", "/es/mis-esim"],
    ["/en/checkout", "/es/compra"],
    ["/en/install", "/es/instalar"],
    ["/en/studio", "/es/estudio"],
  ]) {
    assert.equal(equivalentPath(en, "es"), es);
    assert.equal(equivalentPath(es, "en"), en);
  }
  const plan = plansByDestination.japan[0];
  assert.equal(
    equivalentPath(planPath("en", "japan", plan.id), "es"),
    planPath("es", "japan", plan.id),
  );
  const path = experiencePath("es", "checkout", {
    destination: "japan",
    plan: plan.id,
  });
  const url = new URL(path, "https://example.com");
  assert.equal(url.searchParams.get("plan"), plan.id);
  assert.equal(url.searchParams.get("destination"), "japan");
  assert.ok(planPath("en", "japan", "a/b ?").endsWith("a%2Fb%20%3F"));
});
