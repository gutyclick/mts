import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
test("operations detect only live incidents, deduplicate episodes, lease alerts, preserve unknown balance and protect access", async () => {
  const db = new PGlite(),
    actor = randomUUID(),
    customer = randomUUID(),
    order = randomUUID(),
    unit = randomUUID(),
    email = randomUUID();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create table admin_memberships(user_id uuid primary key);create table checkout_orders(id uuid primary key,status text,livemode boolean,paid_at timestamptz,created_at timestamptz default now());create table esim_fulfillments(id uuid primary key,order_id uuid references checkout_orders(id),state text,qa_authorized boolean default false,email_id text);",
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
    await db.query("insert into admin_memberships values($1)", [actor]);
    await db.query(
      "insert into checkout_orders(id,status,livemode,paid_at)values($1,'paid',true,now()-interval '11 minutes')",
      [order],
    );
    await db.query(
      "insert into esim_fulfillments(id,order_id,state,email_id)values($1,$2,'queued',$3)",
      [unit, order, email],
    );
    await db.exec("update operations_settings set enabled=true");
    const scan = async (balance = 100000, ok = true) => {
      await db.exec("update operations_settings set last_run_at=null");
      const token = (await db.query("select operations_claim_run() as t"))
        .rows[0].t;
      return (
        await db.query("select operations_reconcile($1,$2,$3) as n", [
          token,
          balance,
          ok,
        ])
      ).rows[0].n;
    };
    assert.equal(await scan(), 2);
    assert.equal(
      (await db.query("select operations_claim_run() as t")).rows[0].t,
      null,
    );
    assert.equal(await scan(), 0);
    const snapshot = (
      await db.query("select operations_snapshot($1) as d", [actor])
    ).rows[0].d;
    assert.equal(snapshot.alerts.length, 2);
    assert.ok(!JSON.stringify(snapshot).includes("lease_token"));
    const claims = (
      await db.query("select * from operations_claim_notifications(3)")
    ).rows;
    assert.equal(claims.length, 2);
    assert.equal(
      (await db.query("select * from operations_claim_notifications(3)")).rows
        .length,
      0,
    );
    const low = snapshot.alerts.find((a) => a.kind === "provider_low_balance");
    await db.query("select operations_ack_alert($1,$2)", [actor, low.id]);
    assert.equal(
      (
        await db.query("select state from operational_alerts where id=$1", [
          low.id,
        ])
      ).rows[0].state,
      "acknowledged",
    );
    assert.equal(await scan(null, false), 1);
    assert.equal(
      (
        await db.query(
          "select resolved_at from operational_alerts where id=$1",
          [low.id],
        )
      ).rows[0].resolved_at,
      null,
    );
    await db.exec("update esim_fulfillments set state='sent'");
    await scan(900000, true);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from operational_alerts where state<>'resolved'",
        )
      ).rows[0].n,
      0,
    );
    await db.query(
      "insert into operational_email_events(id,email_id,kind,occurred_at) values('new',$1,'email.bounced',now()),('late',$1,'email.delivered',now()-interval '1 minute')",
      [email],
    );
    assert.equal(await scan(900000, true), 1);
    const failedAlertEmail = randomUUID();
    await db.query(
      "update operational_alerts set notification_state='sent',email_id=$1 where id=$2",
      [failedAlertEmail, low.id],
    );
    await db.query(
      "insert into operational_email_events(id,email_id,kind,occurred_at)values('alert-bounce',$1,'email.bounced',now())",
      [failedAlertEmail],
    );
    assert.equal(await scan(900000, true), 0);
    assert.equal(
      (
        await db.query(
          "select notification_state from operational_alerts where id=$1",
          [low.id],
        )
      ).rows[0].notification_state,
      "review",
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from operational_alerts where kind='email_bounced' and state='open'",
        )
      ).rows[0].n,
      1,
    );
    await db.exec("update checkout_orders set livemode=false");
    await scan(900000, true);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from operational_alerts where state<>'resolved'",
        )
      ).rows[0].n,
      0,
    );
    await assert.rejects(
      db.query("select operations_snapshot($1)", [customer]),
      /admin_required/,
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec("set role " + role);
      await assert.rejects(
        db.query("select * from operational_alerts"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select operations_claim_run()"),
        /permission denied/,
      );
      await db.exec("reset role");
    }
  } finally {
    await db.close();
  }
});
