import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
test("admin memberships cannot be self-assigned; records exclude activation secrets and mutations enforce actor and lease", async () => {
  const db = new PGlite(),
    owner = randomUUID(),
    customer = randomUUID(),
    order = randomUUID(),
    unit = randomUUID();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}');grant usage on schema auth to authenticated;create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
    );
    for (const file of [
      "20261024000100_catalog.sql",
      "20261024000200_customer_accounts.sql",
      "20261024000300_provider_bindings.sql",
      "20261025000100_retail_prices.sql",
      "20261025000300_test_checkout.sql",
      "20261025000400_checkout_recipient_and_elements.sql",
      "20261025000900_esim_fulfillment.sql",
      "20261025001100_administration.sql",
      "20261025001200_admin_guest_attention.sql",
    ])
      await db.exec(
        readFileSync(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    await db.query(
      "insert into auth.users(id,email,email_confirmed_at)values($1,$2,now()),($3,$4,now())",
      [owner, "owner@example.invalid", customer, "customer@example.invalid"],
    );
    await db.query("insert into admin_memberships(user_id) values($1)", [
      owner,
    ]);
    await db.query(
      "insert into checkout_orders(id,user_id,recipient_email,browser_hash,ip_hash,fingerprint,locale,amount_total,status)values($1,$2,'recipient@example.invalid',repeat('a',64),repeat('b',64),repeat('c',64),'es',300,'paid')",
      [order, customer],
    );
    await db.query(
      "insert into checkout_order_items(order_id,plan_id,destination_slug,destination_name,plan_name,data_gb,days,quantity,unit_amount,stripe_price_id)values($1,'PA_0.1_7','panama','{\"es\":\"Panamá\",\"en\":\"Panama\"}','Panama 100MB',0.1,7,1,300,'price_test')",
      [order],
    );
    await db.query(
      "insert into esim_fulfillments(id,order_id,plan_id,unit_index,state,volume_bytes,days,provider_transaction_id,provider_order_no,provider_esim_id,iccid,smdp_address,activation_code,qa_authorized)values($1,$2,'PA_0.1_7',1,'ready',104857600,7,'PRIVATE_TRANSACTION','PRIVATE_ORDER','PRIVATE_ESIM','89852245280001354019','rsp.example.com','PRIVATE_ACTIVATION',true)",
      [unit, order],
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(
        db.query("select admin_overview($1)", [owner]),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select * from admin_plan_overview"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("insert into admin_memberships(user_id)values($1)", [
          customer,
        ]),
        /permission denied/,
      );
      await db.exec("reset role");
    }
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      customer,
    ]);
    assert.equal(
      (await db.query("select user_id from admin_memberships")).rows.length,
      0,
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    assert.equal(
      (await db.query("select user_id from admin_memberships")).rows.length,
      1,
    );
    await db.exec("reset role");
    await assert.rejects(
      db.query("select admin_overview($1)", [customer]),
      /admin_required/,
    );
    const stats = (await db.query("select admin_overview($1)as data", [owner]))
      .rows[0].data;
    assert.equal(stats.liveRevenueCents, 0);
    assert.equal(stats.readyPlans, 1);
    for (const tab of ["plans", "attention", "users", "orders"]) {
      const result = (
        await db.query("select admin_records($1,$2)as data", [owner, tab])
      ).rows[0].data;
      assert.ok(!JSON.stringify(result).includes("PRIVATE_"));
      assert.ok(!JSON.stringify(result).includes("activation_code"));
    }
    const sync = (
      await db.query("select admin_sync_claim($1,$2) as data", [owner, unit])
    ).rows[0].data;
    assert.equal(
      (await db.query("select admin_sync_claim($1,$2)as data", [owner, unit]))
        .rows[0].data,
      null,
    );
    const finish = async (token) =>
      (
        await db.query(
          "select admin_sync_finish($1,$2,$3,'IN_USE','ENABLED',95000000,null,null,true)as ok",
          [owner, unit, token],
        )
      ).rows[0].ok;
    assert.equal(await finish(randomUUID()), false);
    assert.equal(await finish(sync.token), true);
    const refreshed = (
      await db.query("select admin_overview($1)as data", [owner])
    ).rows[0].data;
    assert.equal(refreshed.activePlans, 1);
    assert.equal(refreshed.attention, 1);
    await db.query(
      "update esim_fulfillments set provider_status='USED_UP' where id=$1",
      [unit],
    );
    assert.equal(
      (
        await db.query(
          "select attention from admin_plan_overview where id=$1",
          [unit],
        )
      ).rows[0].attention,
      null,
    );
    await db.query(
      "update esim_fulfillments set provider_status='IN_USE',used_bytes=0,expires_at=now()+interval '24 hours' where id=$1",
      [unit],
    );
    assert.equal(
      (
        await db.query(
          "select attention from admin_plan_overview where id=$1",
          [unit],
        )
      ).rows[0].attention,
      "expiry_soon",
    );
    await assert.rejects(
      db.query("select admin_followup_save($1,$2,$3,false)", [
        customer,
        unit,
        "unauthorized",
      ]),
      /admin_required/,
    );
    await db.query("select admin_followup_save($1,$2,$3,false)", [
      owner,
      unit,
      "Follow up with customer",
    ]);
    assert.equal(
      (await db.query("select count(*)::int as n from admin_audit")).rows[0].n,
      2,
    );
    const literal = (
      await db.query("select admin_records($1,'plans','%')as data", [owner])
    ).rows[0].data;
    assert.equal(literal.total, 0);
  } finally {
    await db.close();
  }
});
