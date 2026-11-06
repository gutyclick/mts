import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { catalogPreviewEnabled } from "../src/lib/catalog-preview.ts";
import { applyRegionalPolicy } from "../src/lib/regional-catalog-policy.ts";
import { applyPreviewPrices } from "../src/lib/catalog-preview-prices.ts";
import { connectivityMode } from "../src/lib/catalog-curation.ts";
const policy = JSON.parse(
  readFileSync("src/data/regional-catalog-policy.json", "utf8"),
);
const row = (slug, code) => ({
  slug,
  code,
  name: { es: slug, en: slug },
  type: "region",
  aliases: [],
  planCount: 5,
  dataMinGb: 1,
  dataMaxGb: 20,
  image: "/illustrations/world.svg",
  artworkKind: "illustration",
});
const destinations = [
  row("europe", "EU-42"),
  row("europe-33-areas", "EU-33"),
  row("asia-20", "AS-20"),
  row("asia-14-areas", "AS-14"),
];
function load(env, planRows = [], approvedPlans = []) {
  const exports = {};
  const dependencies = {
    "server-only": {},
    react: { cache: (fn) => fn },
    "next/server": { connection: async () => {} },
    "./catalog": { destinations },
    "./plans": { getPlans: () => planRows },
    "./supabase/catalog-api": { catalogConfig: () => null },
    "./catalog-curation": {
      connectivityMode,
      isCommerciallyAllowed: () => true,
      curateCatalog: () => ({
        modes: [
          {
            id: "standard",
            plans: approvedPlans.map((plan) => ({ plan })),
            secondaryPlans: [],
          },
        ],
      }),
    },
    "../data/catalog-connectivity-evidence.json": { default: {} },
    "./catalog-preview": { catalogPreviewEnabled },
    "./regional-catalog-policy": { applyRegionalPolicy },
    "./catalog-preview-prices": { applyPreviewPrices },
    "../data/regional-catalog-policy.json": { default: policy },
  };
  const output = ts.transpileModule(
    readFileSync("src/lib/catalog-server.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(output, {
    exports,
    require: (name) => {
      if (!(name in dependencies)) throw Error(name);
      return dependencies[name];
    },
    process: { env },
  });
  return exports;
}
test("local discovery consolidates regions while legacy URLs retain original coverage", async () => {
  const server = load({ CATALOG_REDESIGN_PREVIEW: "true" });
  assert.deepEqual(
    Array.from(await server.getDestinations(), (d) => d.slug),
    ["europe-33-areas", "asia-14-areas"],
  );
  assert.equal((await server.getDestination("europe")).code, "EU-42");
  assert.equal((await server.getDestination("europe-33-areas")).code, "EU-33");
  assert.equal(
    (await server.getPopularDestinations())[0].slug,
    "europe-33-areas",
  );
});

test("production includes all standard durations without enabling unapproved variants", async () => {
  const make = (id, days) => ({
    id,
    name: id,
    dataGb: 3,
    days,
    allowance: "3GB",
    kind: "fixed",
    coverageCode: "BR",
    retailPriceCents: 1000,
    details: {
      dataGb: 3,
      days,
      coverage: ["BR"],
      networks: [
        {
          countryCode: "BR",
          operators: [{ name: "Claro", technologies: ["4G"] }],
        },
      ],
    },
  });
  const rows = [
    make("test-standard-15", 15),
    make("test-standard-30", 30),
    make("test_iij", 30),
  ];
  const server = load({ VERCEL_ENV: "production" }, rows, []);
  const selected = await server.getPlanOptions({
    ...row("brazil", "BR"),
    type: "country",
  });
  assert.deepEqual(
    Array.from(selected, (p) => p.days),
    [15, 30],
  );
  assert.equal(
    selected.some((p) => p.id === "test_iij"),
    false,
  );
});
test("deployed discovery uses approved regions while source prices stay in the database", async () => {
  const server = load({
    CATALOG_REDESIGN_PREVIEW: "true",
    VERCEL_ENV: "production",
  });
  assert.deepEqual(
    Array.from(await server.getDestinations(), (d) => d.slug),
    ["europe-33-areas", "asia-14-areas"],
  );
  assert.equal(
    (await server.getPopularDestinations())[0].slug,
    "europe-33-areas",
  );
});
