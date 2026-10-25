import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
test("paid transition enqueues exact quantities once; test purchases cannot claim; private QA is fenced and publishes owned records atomically", async () => {
  const db = new PGlite(),
    owner = randomUUID(),
    other = randomUUID(),
    id = randomUUID();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);grant usage on schema auth to authenticated;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`,
    );
    for (const file of [
      "20261024000100_catalog.sql",
      "20261024000200_customer_accounts.sql",
      "20261024000300_provider_bindings.sql",
      "20261025000100_retail_prices.sql",
      "20261025000300_test_checkout.sql",
      "20261025000400_checkout_recipient_and_elements.sql",
      "20261025000900_esim_fulfillment.sql",
    ])
      await db.exec(
        readFileSync(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(`insert into auth.users values('${owner}'),('${other}');
   insert into catalog_destinations(slug,name,code,type,image,artwork_kind,is_published) values('panama','{"es":"Panamá","en":"Panama"}','PA','country','/flags/pa.svg','flag',true);
   insert into catalog_plans(id,destination_slug,name,allowance,data_gb,days,coverage_code,is_published,retail_price_cents) values('PA_1_7','panama','Panama 1GB 7Days','1GB',1,7,'PA',true,400);
   insert into provider_package_bindings(plan_id,provider_slug,package_code,volume_bytes,days)values('PA_1_7','PA_1_7','PKG123',1073741824,7);
   insert into checkout_orders(id,user_id,recipient_email,browser_hash,ip_hash,fingerprint,locale,amount_total)values('${id}','${owner}','delivery@example.invalid',repeat('a',64),repeat('b',64),repeat('c',64),'es',800);
   insert into checkout_order_items(order_id,plan_id,destination_slug,destination_name,plan_name,data_gb,days,quantity,unit_amount,stripe_price_id)values('${id}','PA_1_7','panama','{"es":"Panamá","en":"Panama"}','Panama 1GB 7Days',1,7,2,400,'price_test');`);
    assert.equal(
      (await db.query("select * from esim_fulfillments")).rows.length,
      0,
    );
    await db.exec(
      `update checkout_orders set status='paid' where id='${id}';update checkout_orders set status='paid' where id='${id}';`,
    );
    let units = (
      await db.query("select * from esim_fulfillments order by unit_index")
    ).rows;
    assert.equal(units.length, 2);
    assert.equal(units[0].state, "test_skipped");
    assert.notEqual(
      units[0].provider_transaction_id,
      units[1].provider_transaction_id,
    );
    assert.equal(
      (await db.query("select * from claim_esim_fulfillments(2)")).rows.length,
      0,
    );
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select * from esim_fulfillments"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from claim_esim_fulfillments(2)"),
      /permission denied/,
    );
    await db.exec("reset role;set role authenticated");
    await assert.rejects(
      db.query("select access_nonce from esim_fulfillments"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select publish_esim_profile($1,$2,$3)", [
        units[0].id,
        randomUUID(),
        "{}",
      ]),
      /permission denied/,
    );
    await db.exec("reset role");
    await db.query(
      "update esim_fulfillments set qa_authorized=true,state='queued' where id=$1",
      [units[0].id],
    );
    const claimed = (await db.query("select * from claim_esim_fulfillments(2)"))
      .rows;
    assert.equal(claimed.length, 1);
    const unit = claimed[0];
    assert.equal(
      (await db.query("select * from claim_esim_fulfillments(2)")).rows.length,
      0,
    );
    await db.query(
      "update esim_fulfillments set state='provider_pending',provider_order_no='B123' where id=$1",
      [unit.id],
    );
    const profile = {
      transactionId: "TRAN1",
      orderNo: "B123",
      packageSlug: "PA_1_7",
      volumeBytes: 1073741824,
      days: 7,
      status: "GOT_RESOURCE",
      iccid: "89852245280001354019",
      smdpAddress: "rsp.example.com",
      activationCode: "PRIVATE_A",
      usedBytes: 0,
      expiresAt: null,
      apn: null,
    };
    const publish = async (token, body = profile) =>
      (
        await db.query("select publish_esim_profile($1,$2,$3::jsonb) as ok", [
          unit.id,
          token,
          JSON.stringify(body),
        ])
      ).rows[0].ok;
    assert.equal(await publish(randomUUID()), false);
    await assert.rejects(
      publish(unit.lease_token, { ...profile, packageSlug: "foreign" }),
      /invalid_allocation/,
    );
    assert.equal(
      (await db.query("select * from customer_esims")).rows.length,
      0,
    );
    assert.equal(await publish(unit.lease_token), true);
    assert.equal(await publish(unit.lease_token), false);
    assert.equal(
      (await db.query("select * from customer_esims")).rows.length,
      1,
    );
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      other,
    ]);
    assert.equal(
      (await db.query("select * from customer_esims")).rows.length,
      0,
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    assert.equal(
      (await db.query("select activation_code from customer_esims")).rows[0]
        .activation_code,
      "PRIVATE_A",
    );
  } finally {
    await db.close();
  }
});
