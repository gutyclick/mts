import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { applyRegionalPolicy } from "../src/lib/regional-catalog-policy.ts";
const policy = JSON.parse(
  fs.readFileSync(
    new URL("../src/data/regional-catalog-policy.json", import.meta.url),
  ),
);
const fixture = (slug, code = slug) => ({
  slug,
  code,
  name: { es: slug, en: slug },
  aliases: ["legacy search"],
  type: "region",
  planCount: 7,
  dataMinGb: 1,
  dataMaxGb: 100,
  image: "/test.svg",
  artworkKind: "illustration",
});

test("one representative per duplicate family, preserves all original commercial identity", () => {
  const input = policy.groups.flatMap((g) =>
    g.canonicalSlugs.map((slug) => fixture(slug)),
  );
  const before = structuredClone(input);
  const result = applyRegionalPolicy(input);
  assert.equal(result.length, policy.groups.length);
  for (const group of policy.groups) {
    const row = result.find((d) => d.slug === group.sourceSlug);
    assert.ok(row);
    assert.equal(row.code, group.sourceSlug);
    assert.equal(row.planCount, 7);
    assert.equal(row.dataMaxGb, 100);
    assert.deepEqual(row.name, group.displayName);
    assert.ok(row.aliases.includes("legacy search"));
  }
  assert.deepEqual(input, before);
});

test("never substitutes another SKU/catalog when chosen source is absent", () => {
  assert.deepEqual(applyRegionalPolicy([fixture("europe-35-areas")]), []);
  const country = { ...fixture("japan", "JP"), type: "country" };
  assert.strictEqual(applyRegionalPolicy([country])[0], country);
});

test("hides routes and subregions, keeps only the selected affordable families", () => {
  const result = applyRegionalPolicy([
    fixture("china-mainland-hk-macao"),
    fixture("japan-and-south-korea"),
    fixture("balkans-5-areas"),
    fixture("europe"),
    fixture("europe-35-areas"),
    fixture("europe-33-areas"),
    fixture("asia-20"),
    fixture("asia-14-areas"),
  ]);
  assert.deepEqual(
    result.map((d) => d.slug),
    ["europe-33-areas", "asia-14-areas"],
  );
  assert.ok(result[0].aliases.includes("Europe"));
  assert.deepEqual(applyRegionalPolicy(result), result);
});

test("selection groups are unique and public selection data contains no private provider material", () => {
  const slugs = policy.groups.flatMap((g) => g.canonicalSlugs);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const group of policy.groups)
    assert.ok(group.canonicalSlugs.includes(group.sourceSlug));
  assert.doesNotMatch(
    JSON.stringify(policy),
    /wholesale|packageCode|apiKey|secret/i,
  );
});
