import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
test("consented cohorts deduplicate stages, reject browser-paid events, withdraw atomically and retain only bounded private aggregates", async () => {
  const db = new PGlite(),
    actor = randomUUID(),
    hash = "a".repeat(64),
    bucket = "b".repeat(64),
    order = randomUUID(),
    testOrder = randomUUID(),
    late = randomUUID();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create table admin_memberships(user_id uuid primary key);create table catalog_destinations(slug text primary key,name jsonb,is_published boolean);create table checkout_orders(id uuid primary key,status text,livemode boolean,amount_total integer,created_at timestamptz default now(),paid_at timestamptz default now());",
    );
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261026000800_private_sales_measurement.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query("insert into admin_memberships values($1)", [actor]);
    await db.exec(
      "insert into catalog_destinations values('panama','{\"es\":\"Panamá\",\"en\":\"Panama\"}',true),('hidden','{}',false)",
    );
    const event = async (kind, destination = "panama") =>
      (
        await db.query("select analytics_record_client($1,$2,$3) as ok", [
          hash,
          kind,
          destination,
        ])
      ).rows[0].ok;
    assert.equal(await event("destination_view"), false);
    assert.equal(
      (await db.query("select analytics_start($1,$2) as ok", [hash, bucket]))
        .rows[0].ok,
      true,
    );
    assert.equal(await event("paid"), false);
    assert.equal(await event("destination_view", "hidden"), false);
    assert.equal(await event("destination_view"), true);
    assert.equal(await event("destination_view"), false);
    assert.equal(await event("add_to_cart"), true);
    for (const [id, live, amount] of [
      [order, true, 100],
      [testOrder, false, 999],
      [late, true, 200],
    ])
      await db.query(
        "insert into checkout_orders(id,status,livemode,amount_total)values($1,'pending',$2,$3)",
        [id, live, amount],
      );
    assert.equal(
      (
        await db.query("select analytics_attach_checkout($1,$2) as ok", [
          order,
          hash,
        ])
      ).rows[0].ok,
      true,
    );
    assert.equal(
      (
        await db.query("select analytics_attach_checkout($1,$2) as ok", [
          testOrder,
          hash,
        ])
      ).rows[0].ok,
      false,
    );
    await db.query(
      "update checkout_orders set status='paid' where id=any($1)",
      [[order, testOrder]],
    );
    await db.query("update checkout_orders set status='paid' where id=$1", [
      order,
    ]);
    let report = (await db.query("select admin_analytics($1,30) as d", [actor]))
      .rows[0].d;
    assert.deepEqual(report.funnel, {
      sessions: 1,
      view: 1,
      cart: 1,
      checkout: 1,
      paid: 1,
    });
    assert.equal(report.financial.orders, 1);
    await db.query("select analytics_attach_checkout($1,$2)", [late, hash]);
    await db.query("select analytics_forget($1)", [hash]);
    await db.query("update checkout_orders set status='paid' where id=$1", [
      late,
    ]);
    assert.equal(
      (await db.query("select count(*)::int as n from analytics_events"))
        .rows[0].n,
      0,
    );
    assert.equal(
      (await db.query("select analytics_start($1,$2) as ok", [hash, bucket]))
        .rows[0].ok,
      false,
      "an in-flight cookie must not resurrect a withdrawn session",
    );
    assert.equal(
      (
        await db.query(
          "select analytics_cohort from checkout_orders where id=$1",
          [late],
        )
      ).rows[0].analytics_cohort,
      null,
    );
    await db.query(
      "insert into checkout_orders(id,status,livemode,amount_total)values($1,'paid',true,300)",
      [randomUUID()],
    );
    report = (await db.query("select admin_analytics($1,30) as d", [actor]))
      .rows[0].d;
    assert.equal(report.funnel.paid, 0);
    assert.equal(report.financial.orders, 3);
    assert.equal(report.financial.grossCents, 600);
    assert.ok(!JSON.stringify(report).includes(hash));
    const old = "f".repeat(64);
    await db.query(
      "insert into analytics_cohorts(hash,created_at)values($1,now()-interval '31 days')",
      [old],
    );
    await db.query("select analytics_cleanup()");
    assert.equal(
      (await db.query("select count(*)::int as n from analytics_cohorts"))
        .rows[0].n,
      0,
    );
    for (let n = 0; n < 120; n++)
      assert.equal(
        (
          await db.query("select analytics_start($1,$2) as ok", [
            n.toString(16).padStart(64, "0"),
            "c".repeat(64),
          ])
        ).rows[0].ok,
        true,
      );
    assert.equal(
      (
        await db.query("select analytics_start($1,$2) as ok", [
          "d".repeat(64),
          "c".repeat(64),
        ])
      ).rows[0].ok,
      false,
    );
    const fast = randomUUID(),
      past = randomUUID(),
      fastHash = "e".repeat(64);
    await db.query("select analytics_start($1,$2)", [fastHash, "a".repeat(64)]);
    const started = (await db.query("select now() as t")).rows[0].t;
    for (const id of [fast, past])
      await db.query(
        "insert into checkout_orders(id,status,livemode,amount_total,paid_at)values($1,'paid',true,100,now())",
        [id],
      );
    await db.query(
      "update checkout_orders set paid_at=now()-interval '1 hour' where id=$1",
      [past],
    );
    assert.equal(
      (
        await db.query("select analytics_attach_checkout($1,$2,$3) as ok", [
          past,
          fastHash,
          started,
        ])
      ).rows[0].ok,
      false,
      "do not attribute an earlier payment",
    );
    assert.equal(
      (
        await db.query("select analytics_attach_checkout($1,$2,$3) as ok", [
          fast,
          fastHash,
          started,
        ])
      ).rows[0].ok,
      true,
      "a fast callback racing the after-task still counts",
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from analytics_events where cohort_hash=$1 and kind='paid'",
          [fastHash],
        )
      ).rows[0].n,
      1,
    );
    await assert.rejects(
      db.query("select admin_analytics($1,30)", [randomUUID()]),
      /admin_required/,
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec("set role " + role);
      await assert.rejects(
        db.query("select * from analytics_events"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select analytics_start($1,$2)", [hash, bucket]),
        /permission denied/,
      );
      await db.exec("reset role");
    }
  } finally {
    await db.close();
  }
});
