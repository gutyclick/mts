import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
test("a unit refund uses the original charged currency and unit amount, independent of later FX rates", async () => {
  const db = new PGlite(),
    actor = randomUUID(),
    order = randomUUID(),
    unit = randomUUID(),
    quote = randomUUID();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create table admin_memberships(user_id uuid primary key);create table checkout_orders(id uuid primary key,status text,amount_total integer,currency text,livemode boolean,stripe_payment_intent text,stripe_session_id text,expires_at timestamptz,payment_last_seen_at timestamptz,paid_at timestamptz default now(),created_at timestamptz default now());create table checkout_order_items(order_id uuid,plan_id text,quantity integer,unit_amount integer,stripe_price_id text,plan_name text,destination_name jsonb,data_gb numeric,days integer,primary key(order_id,plan_id));create table esim_fulfillments(id uuid primary key,order_id uuid,plan_id text,unit_index integer,state text,qa_authorized boolean default false,provider_order_no text,attempts integer default 0,last_error text,lease_token uuid,lease_until timestamptz,next_attempt_at timestamptz default now(),updated_at timestamptz default now(),email_id text);",
    );
    for (const name of [
      "20261026000500_operational_alerts.sql",
      "20261026000600_admin_refunds.sql",
      "20261026000700_refund_cart_capacity.sql",
      "20261026000900_currency_rates.sql",
      "20261026001000_checkout_currency_snapshots.sql",
      "20261026001100_refund_payment_currencies.sql",
    ])
      await db.exec(
        readFileSync(
          new URL("../supabase/migrations/" + name, import.meta.url),
          "utf8",
        ),
      );
    await db.query("insert into admin_memberships values($1)", [actor]);
    await db.query(
      "insert into fx_snapshots(id,provider_ref,rates,sampled_at)values($1,'fxq_fixture','{}',now())",
      [quote],
    );
    await db.query(
      "insert into checkout_orders(id,status,amount_total,currency,livemode,stripe_payment_intent,payment_currency,payment_total,fx_snapshot_id)values($1,'paid',1000,'usd',true,'pi_fixture','JPY',1500,$2)",
      [order, quote],
    );
    await db.query(
      "insert into checkout_order_items(order_id,plan_id,quantity,unit_amount,stripe_price_id,plan_name,destination_name,data_gb,days,payment_unit_amount)values($1,'plan',2,500,'price_base','5 GB','{\"es\":\"Panamá\",\"en\":\"Panama\"}',5,7,750)",
      [order],
    );
    await db.query(
      "insert into esim_fulfillments(id,order_id,plan_id,unit_index,state)values($1,$2,'plan',1,'queued')",
      [unit, order],
    );
    const request = (
      await db.query("select admin_refund_request($1,$2,$3,$4)as id", [
        actor,
        order,
        [unit],
        "One originally charged unit",
      ])
    ).rows[0].id;
    let r = (
      await db.query(
        "select amount,currency from refund_requests where id=$1",
        [request],
      )
    ).rows[0];
    assert.deepEqual(r, { amount: 750, currency: "jpy" });
    await db.query(
      'update fx_snapshots set rates=\'{"JPY":"9990000000000"}\'where id=$1',
      [quote],
    );
    await db.query("select admin_refund_approve($1,$2,true)", [actor, request]);
    const job = (
      await db.query("select admin_refund_claim($1,$2)as job", [actor, request])
    ).rows[0].job;
    assert.equal(job.amount, 750);
    assert.equal(job.currency, "jpy");
    const view = (
      await db.query("select admin_refund_view($1,$2)as v", [actor, order])
    ).rows[0].v;
    assert.equal(view.order.currency, "jpy");
    assert.equal(view.order.amount, 1500);
    assert.equal(view.order.units[0].amount, 750);
    await assert.rejects(
      db.query(
        "select refund_record_stripe($1,'re_fixture','pi_fixture',500,'usd',true,'succeeded',now())",
        [request],
      ),
      /refund_mismatch/,
    );
    assert.equal(
      (
        await db.query(
          "select refund_record_stripe($1,'re_fixture','pi_fixture',750,'jpy',true,'succeeded',now())as ok",
          [request],
        )
      ).rows[0].ok,
      true,
    );
    r = (
      await db.query(
        "select amount,currency,state from refund_requests where id=$1",
        [request],
      )
    ).rows[0];
    assert.deepEqual(r, { amount: 750, currency: "jpy", state: "succeeded" });
  } finally {
    await db.close();
  }
});
