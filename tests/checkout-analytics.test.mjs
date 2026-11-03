import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import {
  checkoutEventKinds,
  checkoutStatsPath,
  clientEventSchema,
} from "../src/lib/analytics/model.ts";

test("checkout public telemetry accepts only stage names and rejects private or paid data", () => {
  for (const kind of checkoutEventKinds) {
    assert.equal(clientEventSchema.safeParse({ kind }).success, true);
    for (const field of [
      "email",
      "coupon",
      "code",
      "orderId",
      "error",
      "destination",
    ])
      assert.equal(
        clientEventSchema.safeParse({ kind, [field]: "private" }).success,
        false,
      );
  }
  for (const kind of ["paid", "payment_success", "private@example.invalid"])
    assert.equal(clientEventSchema.safeParse({ kind }).success, false);
  assert.equal(checkoutStatsPath("/es/compra"), true);
  assert.equal(checkoutStatsPath("/en/checkout"), true);
  for (const path of [
    "/es/admin",
    "/en/account",
    "/es/compra/confirmed",
    "/en/checkout?email=private",
  ])
    assert.equal(checkoutStatsPath(path), false);
});

test("checkout browser events require consent and respect DNT/GPC and checkout path", async () => {
  const modelUrl = new URL("../src/lib/analytics/model.ts", import.meta.url)
    .href;
  const source = readFileSync(
    new URL("../src/lib/analytics/client.ts", import.meta.url),
    "utf8",
  );
  const output = ts
    .transpileModule(source, {
      compilerOptions: { module: ts.ModuleKind.ESNext },
    })
    .outputText.replace('"./model"', JSON.stringify(modelUrl));
  const client = await import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  );
  const old = Object.fromEntries(
    ["window", "navigator", "fetch"].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const calls = [];
  const browser = { location: { pathname: "/es/compra" }, dispatchEvent() {} };
  const nav = {};
  try {
    Object.defineProperty(globalThis, "window", {
      value: browser,
      configurable: true,
    });
    Object.defineProperty(globalThis, "navigator", {
      value: nav,
      configurable: true,
    });
    globalThis.fetch = async (...args) => {
      calls.push(args);
      return { ok: true };
    };
    client.recordCheckoutStats("checkout_entry");
    assert.equal(calls.length, 0);
    client.setStatsPermission(true);
    client.recordCheckoutStats("checkout_entry");
    assert.deepEqual(JSON.parse(calls[0][1].body), { kind: "checkout_entry" });
    nav.doNotTrack = "1";
    client.recordCheckoutStats("contact_ready");
    nav.doNotTrack = "0";
    nav.globalPrivacyControl = true;
    client.recordCheckoutStats("payment_ready");
    nav.globalPrivacyControl = false;
    browser.location.pathname = "/es/admin";
    client.recordCheckoutStats("payment_attempt");
    browser.location.pathname = "/en/checkout";
    client.setStatsPermission(false);
    client.recordCheckoutStats("payment_error");
    assert.equal(calls.length, 1);
  } finally {
    for (const [key, descriptor] of Object.entries(old)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test("checkout cohorts deduplicate, mature safely, restrict access and retain server-only paid authority", async () => {
  const db = new PGlite();
  const actor = randomUUID(),
    order = randomUUID();
  const fresh = "a".repeat(64),
    abandoned = "b".repeat(64),
    paid = "c".repeat(64),
    bucket = "d".repeat(64);
  const stage = async (hash, kind) =>
    (
      await db.query("select analytics_record_checkout_stage($1,$2) as ok", [
        hash,
        kind,
      ])
    ).rows[0].ok;
  const report = async () =>
    (await db.query("select admin_checkout_analytics($1,30) as d", [actor]))
      .rows[0].d;
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create table admin_memberships(user_id uuid primary key);create table catalog_destinations(slug text primary key,name jsonb,is_published boolean);create table checkout_orders(id uuid primary key,status text,livemode boolean,amount_total integer,created_at timestamptz default now(),paid_at timestamptz default now());",
    );
    for (const migration of [
      "20261026000800_private_sales_measurement.sql",
      "20261103000200_checkout_funnel.sql",
    ])
      await db.exec(
        readFileSync(
          new URL(`../supabase/migrations/${migration}`, import.meta.url),
          "utf8",
        ),
      );
    await db.query("insert into admin_memberships values($1)", [actor]);
    assert.equal(await stage(fresh, "checkout_entry"), false);
    for (const hash of [fresh, abandoned, paid]) {
      await db.query("select analytics_start($1,$2)", [hash, bucket]);
      assert.equal(await stage(hash, "checkout_entry"), true);
      assert.equal(await stage(hash, "checkout_entry"), false);
      assert.equal(await stage(hash, "paid"), false);
    }
    await stage(paid, "contact_ready");
    await stage(paid, "payment_attempt");
    await stage(paid, "coupon_attempted");
    await stage(paid, "coupon_rejected");
    await stage(paid, "coupon_applied");
    await db.query(
      "insert into checkout_orders(id,status,livemode,amount_total)values($1,'pending',true,100)",
      [order],
    );
    await db.query("select analytics_attach_checkout($1,$2)", [order, paid]);
    await db.query("update checkout_orders set status='paid' where id=$1", [
      order,
    ]);
    await db.query(
      "update analytics_cohorts set created_at=now()-interval '31 minutes' where hash=any($1)",
      [[abandoned, paid]],
    );
    await db.query(
      "update analytics_cohorts set created_at=now()-interval '25 minutes' where hash=$1",
      [fresh],
    );
    assert.equal(
      (await report()).matured,
      0,
      "old browsing cohorts with recent checkout entry must not mature early",
    );
    assert.equal((await report()).incomplete, 2);
    await db.query(
      "update checkout_analytics_stages set created_at=now()-interval '31 minutes' where kind='checkout_entry' and cohort_hash=any($1)",
      [[abandoned, paid]],
    );
    await db.query(
      "update checkout_orders set paid_at=now()-interval '2 minutes' where id=$1",
      [order],
    );
    assert.equal(await stage(abandoned, "contact_ready"), false);
    let result = await report();
    assert.deepEqual(result, {
      entry: 3,
      contactReady: 1,
      paymentReady: 0,
      paymentAttempt: 1,
      paymentError: 0,
      couponAttempted: 1,
      couponApplied: 1,
      couponRejected: 1,
      paid: 1,
      incomplete: 1,
      matured: 2,
      maturedUnpaid: 1,
      stopped: {
        afterAttempt: 0,
        beforeContact: 1,
        formUnavailable: 0,
        beforeAttempt: 0,
      },
    });
    assert.ok(!JSON.stringify(result).includes(paid));
    const stops = [
      ["f", ["payment_ready"]],
      ["1", ["contact_ready"]],
      ["2", ["contact_ready", "payment_ready"]],
      ["3", ["payment_attempt"]],
    ];
    for (const [prefix, kinds] of stops) {
      const hash = prefix.repeat(64);
      await db.query("select analytics_start($1,$2)", [hash, bucket]);
      await stage(hash, "checkout_entry");
      for (const kind of kinds) await stage(hash, kind);
      await db.query(
        "update checkout_analytics_stages set created_at=now()-interval '31 minutes' where cohort_hash=$1 and kind='checkout_entry'",
        [hash],
      );
    }
    const withStops = await report();
    assert.deepEqual(withStops.stopped, {
      afterAttempt: 1,
      beforeContact: 2,
      formUnavailable: 1,
      beforeAttempt: 1,
    });
    assert.equal(
      Object.values(withStops.stopped).reduce((sum, n) => sum + n, 0),
      withStops.maturedUnpaid,
      "stop groups must partition matured unpaid cohorts",
    );
    for (const [prefix] of stops)
      await db.query("select analytics_forget($1)", [prefix.repeat(64)]);
    // A purchase earlier in the same consenting session must not convert a later checkout.
    const prior = "e".repeat(64),
      priorOrder = randomUUID();
    await db.query("select analytics_start($1,$2)", [prior, bucket]);
    await db.query(
      "insert into checkout_orders(id,status,livemode,amount_total)values($1,'pending',true,100)",
      [priorOrder],
    );
    await db.query("select analytics_attach_checkout($1,$2)", [
      priorOrder,
      prior,
    ]);
    await db.query(
      "update checkout_orders set status='paid',paid_at=now() where id=$1",
      [priorOrder],
    );
    await stage(prior, "checkout_entry");
    assert.equal(
      (await report()).paid,
      1,
      "a paid event before checkout entry is excluded",
    );
    // An after-response attachment may emit a paid event after entry for an earlier payment.
    await db.query(
      "update analytics_events set created_at=now()+interval '1 second' where cohort_hash=$1 and kind='paid'",
      [prior],
    );
    assert.equal(
      (await report()).paid,
      1,
      "authoritative paid_at before entry is still excluded",
    );
    await db.query("select analytics_forget($1)", [prior]);
    await db.query(
      "update analytics_cohorts set created_at=now()-interval '2 days' where hash=$1",
      [fresh],
    );
    assert.equal(
      (await db.query("select admin_checkout_analytics($1,1) as d", [actor]))
        .rows[0].d.entry,
      3,
      "period selection uses checkout entry rather than earlier browsing",
    );
    await assert.rejects(
      db.query("select admin_checkout_analytics($1,30)", [randomUUID()]),
      /admin_required/,
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(
        db.query("select * from checkout_analytics_stages"),
        /permission denied/,
      );
      await assert.rejects(
        db.query(
          "select analytics_record_checkout_stage($1,'checkout_entry')",
          [fresh],
        ),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select admin_checkout_analytics($1,30)", [actor]),
        /permission denied/,
      );
      await db.exec("reset role");
    }
    await db.query("select analytics_forget($1)", [fresh]);
    assert.equal(await stage(fresh, "checkout_entry"), false);
    assert.equal((await report()).entry, 2);
    await db.query(
      "update analytics_cohorts set created_at=now()-interval '31 days'",
    );
    await db.query("select analytics_cleanup()");
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from checkout_analytics_stages",
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});
