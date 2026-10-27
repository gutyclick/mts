import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
test("price publication changes catalog and both Stripe environments atomically, locks baseline, rejects public calls and is idempotent", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create table catalog_plans(id text primary key,kind text,is_published boolean,retail_price_cents integer);
 create table stripe_catalog_prices(plan_id text,livemode boolean,product_id text,price_id text,amount_cents integer,currency text,updated_at timestamptz,primary key(plan_id,livemode));
 insert into catalog_plans values('p','fixed',true,600),('q','fixed',true,900);
 insert into stripe_catalog_prices values('p',true,'mts_product','price_oldlive',600,'usd',now()),('p',false,'mts_product','price_oldtest',600,'usd',now()),('q',true,'mts_other','price_qlive',900,'usd',now()),('q',false,'mts_other','price_qtest',900,'usd',now());`);
    await db.exec(
      fs.readFileSync(
        "supabase/migrations/20261027000100_pricing_campaign.sql",
        "utf8",
      ),
    );
    const row = {
      plan_id: "p",
      old_cents: 600,
      new_cents: 700,
      product_id: "mts_product",
      live_price_id: "price_newlive",
      test_price_id: "price_newtest",
    };
    for (const role of ["anon", "authenticated"]) {
      await db.exec("set role " + role);
      await assert.rejects(
        db.query("select apply_pricing_campaign($1,$2)", ["campaign", [row]]),
      );
      await db.exec("reset role");
    }
    await assert.rejects(
      db.query("select apply_pricing_campaign($1,$2)", [
        "campaign",
        [row, { ...row, plan_id: "q", old_cents: 800 }],
      ]),
    );
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
        await db.query("select apply_pricing_campaign($1,$2) as n", [
          "campaign",
          [row],
        ])
      ).rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query(
          "select retail_price_cents from catalog_plans where id='p'",
        )
      ).rows[0].retail_price_cents,
      700,
    );
    assert.ok(
      (
        await db.query("select * from stripe_catalog_prices where plan_id='p'")
      ).rows.every(
        (x) => x.amount_cents === 700 && x.price_id.startsWith("price_new"),
      ),
    );
    assert.equal(
      (
        await db.query("select apply_pricing_campaign($1,$2) as n", [
          "campaign",
          [row],
        ])
      ).rows[0].n,
      0,
    );
    await assert.rejects(
      db.query("select apply_pricing_campaign($1,$2)", [
        "campaign",
        [{ ...row, new_cents: 800 }],
      ]),
    );
  } finally {
    await db.close();
  }
});
