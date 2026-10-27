import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { PGlite } from "@electric-sql/pglite";
test("approved revisions allow increases and decreases atomically, reject exclusions, preserve history and replay safely", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table catalog_plans(id text primary key,kind text,is_published boolean,retail_price_cents integer);
 create table stripe_catalog_prices(plan_id text,livemode boolean,product_id text,price_id text,amount_cents integer,currency text,updated_at timestamptz,primary key(plan_id,livemode));
 create table checkout_order_items(id text,amount_cents integer);insert into checkout_order_items values('history',600);
 insert into catalog_plans values('p','fixed',true,600),('q','fixed',true,900),('hidden','fixed',false,300);
 insert into stripe_catalog_prices select id,b,'mts_'||id,'price_old'||id||b,retail_price_cents,'usd',now() from catalog_plans cross join (values(true),(false))v(b);`);
    for (const f of [
      "20261027000100_pricing_campaign.sql",
      "20261027000200_commercial_price_revision.sql",
    ])
      await db.exec(fs.readFileSync("supabase/migrations/" + f, "utf8"));
    const p = {
      plan_id: "p",
      old_cents: 600,
      new_cents: 700,
      product_id: "mts_p",
      live_price_id: "price_newpL",
      test_price_id: "price_newpT",
    };
    const q = {
      ...p,
      plan_id: "q",
      old_cents: 900,
      new_cents: 800,
      product_id: "mts_q",
      live_price_id: "price_newqL",
      test_price_id: "price_newqT",
    };
    const run = (rows, excluded = ["hidden"], hash = "a".repeat(64)) =>
      db.query("select apply_commercial_price_revision($1,$2,$3,$4) as n", [
        "approved",
        rows,
        excluded,
        hash,
      ]);
    for (const role of ["anon", "authenticated"]) {
      await db.exec("set role " + role);
      await assert.rejects(run([p, q]));
      await db.exec("reset role");
    }
    await assert.rejects(run([p, q], ["q"]));
    await assert.rejects(run([p, { ...q, old_cents: 1000 }]));
    assert.equal(
      (
        await db.query(
          "select retail_price_cents from catalog_plans where id='p'",
        )
      ).rows[0].retail_price_cents,
      600,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from pricing_campaign_changes",
        )
      ).rows[0].n,
      0,
    );
    await assert.rejects(run([p, { ...q, new_cents: 850 }]));
    assert.equal((await run([p, q])).rows[0].n, 2);
    assert.deepEqual(
      (
        await db.query(
          "select retail_price_cents from catalog_plans where id in ('p','q') order by id",
        )
      ).rows.map((r) => r.retail_price_cents),
      [700, 800],
    );
    assert.equal((await run([p, q])).rows[0].n, 0);
    await assert.rejects(run([p, q], ["hidden"], "b".repeat(64)));
    assert.deepEqual(
      (
        await db.query(
          "select old_cents,new_cents from pricing_campaign_changes order by plan_id",
        )
      ).rows,
      [
        { old_cents: 600, new_cents: 700 },
        { old_cents: 900, new_cents: 800 },
      ],
    );
    assert.equal(
      (await db.query("select amount_cents from checkout_order_items")).rows[0]
        .amount_cents,
      600,
    );
    await db.exec(`insert into catalog_plans select 'bulk'||g,'fixed',true,600 from generate_series(1,590)g;
      insert into stripe_catalog_prices select id,b,'mts_'||id,'price_old'||id||b,600,'usd',now() from catalog_plans cross join(values(true),(false))v(b) where id like 'bulk%';`);
    const bulk = Array.from({ length: 590 }, (_, i) => ({
      plan_id: "bulk" + (i + 1),
      old_cents: 600,
      new_cents: i % 2 ? 700 : 500,
      product_id: "mts_bulk" + (i + 1),
      live_price_id: "price_bulkL" + i,
      test_price_id: "price_bulkT" + i,
    }));
    assert.equal(
      (
        await db.query(
          "select apply_commercial_price_revision($1,$2,$3,$4) as n",
          ["bulk-revision", bulk, ["hidden"], "c".repeat(64)],
        )
      ).rows[0].n,
      590,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from pricing_campaign_changes where campaign='bulk-revision'",
        )
      ).rows[0].n,
      590,
    );
  } finally {
    await db.close();
  }
});
