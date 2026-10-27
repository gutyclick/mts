import test from "node:test";
import assert from "node:assert/strict";
import {
  mergeMessages,
  findChatDestination,
  selectChatPlans,
  planReferences,
} from "../src/lib/support/chat-catalog.ts";
test("history merging deduplicates retries and never loses newer replies to a stale refresh", () => {
  const a = { id: "a", created_at: "2026-10-27T00:00:00Z" },
    b = { id: "b", created_at: "2026-10-27T00:00:01Z" };
  assert.deepEqual(
    mergeMessages([a, b], [a]).map((x) => x.id),
    ["a", "b"],
  );
  assert.equal(mergeMessages([a], [a, b]).length, 2);
});
test("country matching uses the latest explicit destination and whole names, not substrings", () => {
  const ds = [
    {
      slug: "japan",
      name: { es: "Japón", en: "Japan" },
      aliases: [],
      code: "JP",
    },
    { slug: "oman", name: { es: "Omán", en: "Oman" }, aliases: [], code: "OM" },
  ];
  assert.equal(
    findChatDestination(["Japón 10 días", "ahora quiero Omán"], ds)?.slug,
    "oman",
  );
  assert.equal(findChatDestination(["woman"], ds), null);
});
test("recommendations select bounded fixed plans and generate only exact local catalog links", () => {
  const ps = [
    {
      id: "JP_10_30",
      name: "Japan",
      kind: "fixed",
      dataGb: 10,
      days: 30,
      retailPriceCents: 1100,
    },
    {
      id: "JP_1_7",
      name: "Japan",
      kind: "fixed",
      dataGb: 1,
      days: 7,
      retailPriceCents: 300,
    },
    {
      id: "daily",
      name: "Daily",
      kind: "daily",
      dataGb: 10,
      days: 30,
      retailPriceCents: 100,
    },
  ];
  const plans = selectChatPlans(ps, "Quiero 10 GB para 20 días");
  assert.equal(plans[0].id, "JP_10_30");
  assert.ok(!plans.some((p) => p.id === "daily"));
  const refs = planReferences(
    ["evil", "JP_10_30", "JP_10_30"],
    plans,
    { slug: "japan", name: { es: "Japón", en: "Japan" } },
    "es",
  );
  assert.equal(refs.length, 1);
  assert.equal(refs[0].href, "/es/esim/japan?plan=JP_10_30");
  assert.equal(refs[0].priceCents, 1100);
});

test("latest trip correction wins and mixed destinations require clarification", () => {
  const plans = [
    {
      id: "short",
      name: "Trip",
      kind: "fixed",
      dataGb: 10,
      days: 15,
      retailPriceCents: 500,
    },
    {
      id: "long",
      name: "Trip",
      kind: "fixed",
      dataGb: 10,
      days: 30,
      retailPriceCents: 900,
    },
  ];
  assert.deepEqual(
    selectChatPlans(plans, "10 días, mejor 25 días y 10 GB").map((p) => p.id),
    ["long"],
  );
  assert.equal(
    findChatDestination(
      ["Japan and Oman"],
      [
        { slug: "japan", name: { es: "Japón", en: "Japan" } },
        { slug: "oman", name: { es: "Omán", en: "Oman" } },
      ],
    ),
    null,
  );
});

test("simple purchase recommendations use catalog facts without inventing exact durations", async () => {
  const { directPlanRecommendation } =
    await import("../src/lib/support/chat-catalog.ts");
  const plans = selectChatPlans(
    [
      {
        id: "JP_10_30",
        name: "Japan",
        kind: "fixed",
        dataGb: 10,
        days: 30,
        retailPriceCents: 1100,
      },
    ],
    "10 GB 20 días",
  );
  assert.deepEqual(
    directPlanRecommendation("Quiero 10 GB para 20 días", plans, "es")?.planIds,
    ["JP_10_30"],
  );
  assert.match(
    directPlanRecommendation("Quiero 10 GB para 20 días", plans, "es").answer,
    /30 días/,
  );
  assert.equal(
    directPlanRecommendation(
      "Mi plan de 10 GB 20 días no funciona",
      plans,
      "es",
    ),
    null,
  );
});
