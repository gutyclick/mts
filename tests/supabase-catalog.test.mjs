import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  catalogConfig,
  createCatalogAPI,
} from "../src/lib/supabase/catalog-api.ts";
import {
  planSchema,
  parsePlanRow,
  parseDestinationRow,
} from "../src/lib/supabase/catalog-schema.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const config = {
  url: "https://example.supabase.co",
  key: "sb_publishable_example",
};
const plan = {
  id: "test",
  name: "Test 1GB",
  allowance: "1GB",
  dataGb: 1,
  days: 7,
  kind: "fixed",
  coverageCode: "TEST",
};

test("configuration is explicit, server-only and rejects privileged credentials", () => {
  assert.equal(catalogConfig({}), null);
  assert.throws(() => catalogConfig({ SUPABASE_URL: config.url }));
  assert.throws(() => catalogConfig({ SUPABASE_PUBLISHABLE_KEY: config.key }));
  for (const key of ["sb_secret_example", "legacy-jwt", ""])
    assert.throws(() =>
      catalogConfig({
        SUPABASE_URL: config.url,
        SUPABASE_PUBLISHABLE_KEY: key,
      }),
    );
  assert.deepEqual(
    catalogConfig({
      SUPABASE_URL: config.url,
      SUPABASE_PUBLISHABLE_KEY: config.key,
    }),
    config,
  );
  assert.throws(() =>
    catalogConfig({
      SUPABASE_URL: "http://external.example",
      SUPABASE_PUBLISHABLE_KEY: config.key,
    }),
  );
});

test("catalog API paginates, excludes commercial data and preserves empty catalogs", async () => {
  let calls = 0;
  const client = createCatalogAPI(config, async (url, options) => {
    assert.equal(options.cache, "no-store");
    assert.equal(options.headers.apikey, config.key);
    assert.ok(!url.searchParams.get("select").includes("*"));
    const offset = Number(url.searchParams.get("offset"));
    calls++;
    return Response.json(
      Array.from({ length: offset === 0 ? 500 : 1 }, (_, i) => ({
        ...plan,
        id: `test-${offset + i}`,
        data_gb: 1,
        coverage_code: "TEST",
        price: 99,
      })),
    );
  });
  const result = await client.plans("test");
  assert.equal(result.length, 501);
  assert.equal(calls, 2);
  assert.ok(result.every((p) => !("price" in p) && !("data_gb" in p)));
  assert.deepEqual(
    await createCatalogAPI(config, async () =>
      Response.json([]),
    ).destinations(),
    [],
  );
});

test("catalog failures never return bundled plans or leak upstream credentials", async () => {
  for (const response of [
    Response.json({}, { status: 503 }),
    Response.json({ error: "private" }),
    Response.json([{ ...plan, kind: "daily" }]),
  ]) {
    await assert.rejects(
      createCatalogAPI(config, async () => response).plans("test"),
      /catalog|plan data/,
    );
  }
  await assert.rejects(
    createCatalogAPI(config, async () => {
      throw new Error(config.key);
    }).destinations(),
    (e) => !e.message.includes(config.key),
  );
  await assert.rejects(
    createCatalogAPI(config).plans("test&select=*"),
    /Invalid destination/,
  );
  assert.throws(() => planSchema.parse({ ...plan, details: { dataGb: 2 } }));
});

test("migration and full seed enforce publication, fixed-only catalog, RLS and denied writes", async () => {
  const db = new PGlite();
  try {
    await db.exec("create role anon; create role authenticated;");
    await db.exec(read("../supabase/migrations/20261024000100_catalog.sql"));
    await db.exec(read("../supabase/seed.sql"));
    await db.exec(read("../supabase/seed.sql"));
    const counts = await db.query(
      "select (select count(*)::int from catalog_destinations) as destinations, (select count(*)::int from catalog_plans) as plans",
    );
    assert.deepEqual(counts.rows, [{ destinations: 241, plans: 1730 }]);
    const allDestinations = (
      await db.query("select * from published_catalog_destinations")
    ).rows;
    const allPlans = (await db.query("select * from catalog_plans")).rows;
    assert.equal(allDestinations.map(parseDestinationRow).length, 241);
    assert.equal(allPlans.map(parsePlanRow).length, 1730);
    const schema = await db.query(
      "select column_name from information_schema.columns where table_name in ('catalog_plans','catalog_destinations')",
    );
    assert.ok(
      schema.rows.every(
        (r) => !/price|cost|secret|password/i.test(r.column_name),
      ),
    );
    await db.exec(
      "update catalog_plans set is_published = false where id = (select id from catalog_plans where destination_slug = 'japan' limit 1); update catalog_destinations set is_published = false where slug = 'france';",
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from catalog_destinations where slug = 'france'",
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from catalog_plans where destination_slug = 'france' or not is_published",
          )
        ).rows[0].n,
        0,
      );
      assert.equal(
        (
          await db.query(
            "select count(*)::int as n from published_catalog_destinations where slug = 'france'",
          )
        ).rows[0].n,
        0,
      );
      const ranges = (
        await db.query(
          "select plan_count from published_catalog_destinations where slug = 'japan'",
        )
      ).rows[0];
      const japan = (
        await db.query(
          "select count(*)::int as n from catalog_plans where destination_slug = 'japan'",
        )
      ).rows[0].n;
      assert.equal(ranges.plan_count, japan);
      for (const sql of [
        "update catalog_plans set days = 9",
        "delete from catalog_destinations",
        "insert into catalog_destinations (slug) values ('illegal')",
        "update published_catalog_destinations set name = '{}'::jsonb",
      ])
        await assert.rejects(
          db.exec(sql),
          /permission denied|not automatically updatable|cannot update view/,
        );
      await db.exec("reset role");
    }
    await assert.rejects(
      db.exec(
        "update catalog_plans set kind = 'daily' where destination_slug = 'japan'",
      ),
      /check constraint/,
    );
    await assert.rejects(
      db.exec(
        "update catalog_plans set days = 0 where destination_slug = 'japan'",
      ),
      /check constraint/,
    );
    await assert.rejects(
      db.exec(
        "update catalog_plans set details = '{}'::jsonb where destination_slug = 'japan'",
      ),
      /check constraint/,
    );
    await assert.rejects(
      db.exec(
        "update catalog_destinations set name = '{}'::jsonb where slug = 'japan'",
      ),
      /check constraint/,
    );
    await db.exec(
      "update catalog_destinations set is_published = false where slug = 'japan'",
    );
    await db.exec(read("../supabase/seed.sql"));
    assert.equal(
      (
        await db.query(
          "select is_published from catalog_destinations where slug = 'japan'",
        )
      ).rows[0].is_published,
      false,
    );
  } finally {
    await db.close();
  }
});
