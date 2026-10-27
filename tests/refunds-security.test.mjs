import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
test("refund units, approvals and reconciliation enforce money, membership and fulfillment locks", async () => {
  const db = new PGlite(),
    actor = randomUUID(),
    customer = randomUUID(),
    order = randomUUID(),
    a = randomUUID(),
    b = randomUUID(),
    c = randomUUID();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create table admin_memberships(user_id uuid primary key);create table checkout_orders(id uuid primary key,status text,amount_total integer,currency text,livemode boolean,stripe_payment_intent text);create table checkout_order_items(order_id uuid,plan_id text,unit_amount integer,plan_name text,destination_name jsonb,data_gb numeric,days integer,primary key(order_id,plan_id));create table esim_fulfillments(id uuid primary key,order_id uuid,plan_id text,unit_index integer,state text,qa_authorized boolean default false,provider_order_no text,attempts integer default 0,last_error text,lease_token uuid,lease_until timestamptz,next_attempt_at timestamptz default now(),updated_at timestamptz default now());",
    );
    await db.exec(
      "alter table checkout_orders add paid_at timestamptz default now()-interval '11 minutes',add created_at timestamptz default now()-interval '11 minutes';alter table esim_fulfillments add email_id text;",
    );
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261026000500_operational_alerts.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261026000600_admin_refunds.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query("insert into admin_memberships values($1)", [actor]);
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261026000700_refund_cart_capacity.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query(
      "insert into checkout_orders(id,status,amount_total,currency,livemode,stripe_payment_intent) values($1,'paid',1000,'usd',true,'pi_fixture')",
      [order],
    );
    await db.query(
      "insert into checkout_order_items values($1,'a',400,'4 GB','{\"es\":\"Panamá\"}',4,7),($1,'b',200,'2 GB','{\"es\":\"Panamá\"}',2,7)",
      [order],
    );
    for (const [id, plan, index] of [
      [a, "a", 1],
      [b, "a", 2],
      [c, "b", 1],
    ])
      await db.query(
        "insert into esim_fulfillments(id,order_id,plan_id,unit_index,state)values($1,$2,$3,$4,'queued')",
        [id, order, plan, index],
      );
    const request = async (units, who = actor) =>
      (
        await db.query("select admin_refund_request($1,$2,$3,$4) as id", [
          who,
          order,
          units,
          "Individual review approved for testing",
        ])
      ).rows[0].id;
    await assert.rejects(request([a], customer), /admin_required/);
    const id = await request([a]);
    assert.equal(
      (await db.query("select amount from refund_requests where id=$1", [id]))
        .rows[0].amount,
      400,
    );
    await assert.rejects(request([a]), /duplicate key|already_reserved/);
    await assert.rejects(
      db.query("select admin_refund_approve($1,$2,false)", [actor, id]),
      /acknowledgement_required/,
    );
    await db.query(
      "update esim_fulfillments set lease_until=now()+interval '2 minutes' where id=$1",
      [a],
    );
    await assert.rejects(
      db.query("select admin_refund_approve($1,$2,true)", [actor, id]),
      /fulfillment_busy/,
    );
    await db.query(
      "update esim_fulfillments set lease_until=null where id=$1",
      [a],
    );
    await db.query("select admin_refund_approve($1,$2,true)", [actor, id]);
    const claimed = (await db.query("select * from claim_esim_fulfillments(5)"))
      .rows;
    assert.ok(!claimed.some((x) => x.id === a));
    const execution = (
      await db.query("select admin_refund_claim($1,$2) as r", [actor, id])
    ).rows[0].r;
    assert.ok(execution.lease_token);
    assert.equal(
      (await db.query("select admin_refund_claim($1,$2) as r", [actor, id]))
        .rows[0].r,
      null,
    );
    await assert.rejects(
      db.query(
        "select refund_record_stripe($1,'re_fixture','pi_fixture',401,'usd',true,'succeeded',now())",
        [id],
      ),
      /refund_mismatch/,
    );
    await db.query(
      "select refund_record_stripe($1,'re_fixture','pi_fixture',400,'usd',true,'pending',now())",
      [id],
    );
    await db.query(
      "select refund_record_stripe($1,'re_fixture','pi_fixture',400,'usd',true,'succeeded',now()-interval '1 minute')",
      [id],
    );
    await db.query(
      "select refund_record_stripe($1,'re_fixture','pi_fixture',400,'usd',true,'pending',now()+interval '1 second')",
      [id],
    );
    assert.equal(
      (await db.query("select state from refund_requests where id=$1", [id]))
        .rows[0].state,
      "succeeded",
    );
    assert.equal(
      (
        await db.query("select held from refund_units where request_id=$1", [
          id,
        ])
      ).rows[0].held,
      true,
    );
    await db.exec("update operations_settings set enabled=true");
    const monitorToken = (await db.query("select operations_claim_run() as t"))
      .rows[0].t;
    await db.query("select operations_reconcile($1,900000,true)", [
      monitorToken,
    ]);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from operational_alerts where unit_id=$1 and kind='paid_without_delivery'",
          [a],
        )
      ).rows[0].n,
      0,
    );
    await db.exec(
      "update esim_fulfillments set lease_until=null,lease_token=null",
    );
    const failed = await request([b]);
    await db.query("select admin_refund_approve($1,$2,true)", [actor, failed]);
    await db.query("select admin_refund_claim($1,$2)", [actor, failed]);
    await db.query(
      "select refund_record_stripe($1,'re_failed','pi_fixture',400,'usd',true,'failed',now())",
      [failed],
    );
    assert.ok(await request([b]));
    const rejected = await request([c]);
    await db.query("select admin_refund_reject($1,$2)", [actor, rejected]);
    assert.ok(await request([c]));
    const unrelatedOrder = randomUUID();
    await db.query(
      "insert into checkout_orders(id,status,amount_total,currency,livemode,stripe_payment_intent) values($1,'paid',1000,'usd',true,'pi_other')",
      [unrelatedOrder],
    );
    await db.query(
      "insert into refund_requests(order_id,amount,currency,livemode,payment_intent,reason,requested_by)values($1,100,'usd',true,'pi_other','Unrelated order review',$2)",
      [unrelatedOrder, actor],
    );
    const view = (
      await db.query("select admin_refund_view($1,$2) as d", [actor, order])
    ).rows[0].d;
    assert.equal(view.order.units.length, 3);
    assert.ok(view.recent.every((r) => r.order_id === order));
    assert.ok(!JSON.stringify(view).includes("lease_token"));
    assert.ok(!JSON.stringify(view).includes("stripe_payment_intent"));
    await assert.rejects(
      db.query("select admin_refund_view($1,$2)", [customer, order]),
      /admin_required/,
    );
    const bulkOrder = randomUUID();
    await db.query(
      "insert into checkout_orders(id,status,amount_total,currency,livemode,stripe_payment_intent)values($1,'paid',200,'usd',false,'pi_bulk')",
      [bulkOrder],
    );
    await db.query(
      "insert into checkout_order_items select $1,'bulk_'||n,1,'Bulk','{}',1,7 from generate_series(1,20)n",
      [bulkOrder],
    );
    await db.query(
      "insert into esim_fulfillments(id,order_id,plan_id,unit_index,state)select gen_random_uuid(),$1,'bulk_'||ceil(n::numeric/10)::int,((n-1)%10)+1,'test_skipped' from generate_series(1,200)n",
      [bulkOrder],
    );
    const bulkUnits = (
      await db.query("select id from esim_fulfillments where order_id=$1", [
        bulkOrder,
      ])
    ).rows.map((x) => x.id);
    const bulk = (
      await db.query("select admin_refund_request($1,$2,$3,$4) as id", [
        actor,
        bulkOrder,
        bulkUnits,
        "Full cart boundary test",
      ])
    ).rows[0].id;
    assert.equal(
      (await db.query("select amount from refund_requests where id=$1", [bulk]))
        .rows[0].amount,
      200,
    );
    await assert.rejects(
      db.query("select admin_refund_request($1,$2,$3,$4)", [
        actor,
        bulkOrder,
        [...bulkUnits, randomUUID()],
        "Oversized cart test",
      ]),
      /invalid_units/,
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec("set role " + role);
      await assert.rejects(
        db.query("select * from refund_requests"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select admin_refund_request($1,$2,$3,$4)", [
          actor,
          order,
          [a],
          "forged actor claim",
        ]),
        /permission denied/,
      );
      await db.exec("reset role");
    }
  } finally {
    await db.close();
  }
});
