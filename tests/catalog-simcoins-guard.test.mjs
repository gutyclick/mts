import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

async function fixture() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key);create function auth.uid()returns uuid language sql as 'select null::uuid';
    create table catalog_destinations(slug text primary key,is_published bool default true);insert into catalog_destinations values('japan',true);
    create table catalog_plans(id text primary key,destination_slug text default 'japan',retail_price_cents int,is_published bool default true,kind text default 'fixed');
    create table admin_memberships(user_id uuid primary key);
    create table checkout_orders(id uuid primary key,user_id uuid,status text default 'pending',amount_total int,currency text default 'usd',livemode bool default true,created_at timestamptz default now(),paid_at timestamptz,payment_in_progress bool default false,stripe_session_id text,expires_at timestamptz,payment_last_seen_at timestamptz);
    create table checkout_order_items(order_id uuid references checkout_orders,plan_id text,destination_slug text default 'japan',quantity int,unit_amount int,stripe_price_id text,primary key(order_id,plan_id));
    create table esim_fulfillments(id uuid primary key,order_id uuid,plan_id text,unit_index int,state text,provider_order_no text,provider_esim_id text,iccid text,smdp_address text,activation_code text,email_id text,sent_at timestamptz,qa_authorized bool default false);
    create table operational_email_events(id text primary key,email_id uuid,kind text,occurred_at timestamptz);
    create table refund_requests(id uuid primary key,order_id uuid,state text,amount int,currency text);
    create table refund_units(request_id uuid,unit_id uuid,amount int,active bool default true,held bool default true);`);
  for (const file of [
    "20261026000900_currency_rates.sql",
    "20261026001000_checkout_currency_snapshots.sql",
    "20261027000300_simcoins.sql",
    "20261101000100_checkout_coupons.sql",
    "20261101000200_coupon_audit_immutable.sql",
    "20261101000300_coupon_live_mode.sql",
    "20261103000100_promotion_cost_refresh.sql",
    "20261103000300_coupon_insights.sql",
  ]) {
    await db.exec(
      readFileSync(
        new URL("../supabase/migrations/" + file, import.meta.url),
        "utf8",
      ),
    );
  }
  const user = randomUUID();
  await db.query("insert into auth.users values($1);", [user]);
  await db.query("insert into admin_memberships values($1)", [user]);
  await db.exec(
    "insert into catalog_plans(id,retail_price_cents)values('plan',1000);insert into simcoins_private_costs values('plan',10000,now(),null)",
  );
  return { db, user };
}
test("existing SimCoins snapshot cannot prepare hidden or incident-blocked SKUs, and original preparation remains private", async () => {
  const { db, user } = await fixture();
  const order = randomUUID(),
    account = randomUUID(),
    quote = randomUUID();
  try {
    await db.exec(
      "alter table catalog_plans add days int default 7,add allowance text default '1GB';create table provider_package_bindings(plan_id text,provider_slug text,days int,is_available boolean,volume_bytes bigint);",
    );
    for (const file of [
      "20261103000400_catalog_merchandising.sql",
      "20261103000500_catalog_simcoins_guard.sql",
    ])
      await db.exec(
        readFileSync(
          new URL("../supabase/migrations/" + file, import.meta.url),
          "utf8",
        ),
      );
    await db.query(
      "insert into checkout_orders(id,user_id,amount_total)values($1,$2,1000)",
      [order, user],
    );
    await db.query(
      "insert into checkout_order_items(order_id,plan_id,quantity,unit_amount)values($1,'plan',1,1000)",
      [order],
    );
    await db.query("insert into simcoins_accounts(id,user_id)values($1,$2)", [
      account,
      user,
    ]);
    const snapshot = {
      lines: [{ planId: "plan", quantity: 1, netUnitCents: 800 }],
    };
    await db.query(
      "insert into simcoins_quotes(id,account_id,cart_hash,currency,snapshot)values($1,$2,repeat('a',64),'USD',$3)",
      [quote, account, snapshot],
    );
    await db.query(
      "insert into simcoins_order_snapshots(order_id,account_id,quote_id,policy_version,snapshot,release_delay_seconds)values($1,$2,$3,1,$4,0)",
      [order, account, quote, snapshot],
    );
    await db.exec(
      "insert into provider_package_bindings values('plan','plan',7,true,1073741824);grant select on catalog_plans,catalog_destinations to anon,authenticated;",
    );
    async function publicIds() {
      await db.exec("set role anon");
      const rows = (await db.query("select * from catalog_available_plan_ids"))
        .rows;
      await assert.rejects(
        db.query("select volume_bytes from catalog_available_plan_ids"),
      );
      await db.exec("reset role");
      return rows;
    }
    assert.deepEqual(await publicIds(), [{ id: "plan" }]);
    await db.exec(
      "update provider_package_bindings set volume_bytes=1000000000",
    );
    assert.deepEqual(await publicIds(), [{ id: "plan" }]);
    await db.exec(
      "update provider_package_bindings set volume_bytes=2147483648",
    );
    assert.deepEqual(await publicIds(), []);
    await db.exec(
      "update catalog_plans set allowance='100MB';update provider_package_bindings set volume_bytes=104857600",
    );
    assert.deepEqual(await publicIds(), [{ id: "plan" }]);
    await db.exec(
      "update provider_package_bindings set volume_bytes=100000000",
    );
    assert.deepEqual(await publicIds(), [{ id: "plan" }]);
    await db.exec("update catalog_plans set allowance='unknown'");
    assert.deepEqual(await publicIds(), []);
    const rule = {
      plan_id: "plan",
      visibility: "hide",
      commercial_category: null,
      recommendation_eligible: true,
      incident_block: false,
      main_priority: null,
    };
    for (const blocked of [
      rule,
      { ...rule, visibility: "auto", incident_block: true },
    ]) {
      await db.query("select catalog_merchandising_save($1,'plan',$2)", [
        user,
        blocked,
      ]);
      await db.exec("set role service_role");
      await assert.rejects(
        db.query(
          "select simcoins_prepare_payment(p_order=>$1,p_currency=>'USD',p_quote=>null,p_expected=>800)",
          [order],
        ),
        /catalog_plan_unavailable/,
      );
      await assert.rejects(
        db.query(
          "select catalog_original_simcoins_prepare_payment($1,'USD',null,800)",
          [order],
        ),
        /permission denied/,
      );
      await db.exec("reset role");
      assert.equal(
        (
          await db.query(
            "select payment_currency from checkout_orders where id=$1",
            [order],
          )
        ).rows[0].payment_currency,
        null,
      );
    }
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(
        db.query("select simcoins_prepare_payment($1,'USD',null,800)", [order]),
        /permission denied/,
      );
      await db.exec("reset role");
    }
    await db.query("select catalog_merchandising_save($1,'plan',$2)", [
      user,
      { ...rule, visibility: "auto" },
    ]);
    await db.exec("set role service_role");
    const prepared = await db.query(
      "select simcoins_prepare_payment(p_order=>$1,p_currency=>'USD',p_quote=>null,p_expected=>800) value",
      [order],
    );
    await db.exec("reset role");
    assert.equal(prepared.rows[0].value.payment_total, 800);
    assert.equal(
      (await db.query("select retail_price_cents from catalog_plans")).rows[0]
        .retail_price_cents,
      1000,
    );
    assert.equal(
      (await db.query("select count(*)::int n from simcoins_order_snapshots"))
        .rows[0].n,
      1,
    );
  } finally {
    await db.close();
  }
});
