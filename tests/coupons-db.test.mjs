import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const identity = "a".repeat(64);
const otherIdentity = "b".repeat(64);
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
async function save(
  db,
  user,
  value = {},
  request = randomUUID(),
  action = "save",
) {
  return (
    await db.query("select coupon_admin_save($1,$2,$3,$4) v", [
      user,
      {
        code: "TRAVEL20",
        name: "Travel promotion",
        kind: "percent",
        value: 2000,
        ...value,
      },
      action,
      request,
    ])
  ).rows[0].v;
}
function cart(quantity = 1) {
  return [{ destination: "japan", planId: "plan", quantity }];
}
async function quote(db, user, code = "TRAVEL20", options = {}) {
  return (
    await db.query("select coupon_create_quote($1,$2,$3,$4,$5,$6,$7) v", [
      code,
      options.identity ?? identity,
      user,
      options.lines ?? cart(),
      options.currency ?? "USD",
      options.fx ?? null,
      options.rateKey ?? identity,
    ])
  ).rows[0].v;
}
async function order(db, user, quantity = 1) {
  const id = randomUUID();
  await db.query(
    "insert into checkout_orders(id,user_id,amount_total)values($1,$2,$3)",
    [id, user, quantity * 1000],
  );
  await db.query(
    "insert into checkout_order_items(order_id,plan_id,quantity,unit_amount,stripe_price_id)values($1,'plan',$2,1000,'price_fixture')",
    [id, quantity],
  );
  return id;
}
async function prepare(db, id, q, hash = identity, fx = null) {
  return (
    await db.query("select coupon_prepare_payment($1,$2,$3,$4,$5,$6) v", [
      id,
      hash,
      q.id,
      q.currency,
      fx,
      q.paymentTotal,
    ])
  ).rows[0].v;
}

test("coupon CRUD is audited, idempotent, versioned and private to the server", async () => {
  const { db, user } = await fixture();
  try {
    const req = randomUUID(),
      c = await save(db, user, {}, req);
    assert.deepEqual(await save(db, user, {}, req), c);
    await assert.rejects(
      save(db, user, { value: 1000 }, req),
      /coupon_request_conflict/,
    );
    await assert.rejects(save(db, randomUUID()), /admin_required/);
    await assert.rejects(
      db.query("select coupon_admin_snapshot($1)", [randomUUID()]),
      /admin_required/,
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(
        db.query("select coupon_admin_snapshot($1)", [user]),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select * from coupon_definitions"),
        /permission denied/,
      );
      await assert.rejects(quote(db, user), /permission denied/);
      await db.exec("reset role");
    }
    const edited = await save(db, user, {
      id: c.id,
      name: "Changed",
      value: 1500,
    });
    assert.equal(edited.version, 2);
    const snapshot = (
      await db.query("select coupon_admin_snapshot($1)v", [user])
    ).rows[0].v;
    assert.equal(snapshot.coupons[0].name, "Changed");
    assert.equal(snapshot.summary.active, 1);
    assert.equal(
      (await db.query("select count(*)::int n from coupon_audit_logs")).rows[0]
        .n,
      2,
    );
    await assert.rejects(
      db.exec("update coupon_audit_logs set action='forged'"),
      /coupon_audit_immutable/,
    );
    await assert.rejects(
      db.exec("delete from coupon_audit_logs"),
      /coupon_audit_immutable/,
    );
    await db.exec("set role service_role");
    assert.equal(
      (await db.query("select coupon_admin_snapshot($1)v", [user])).rows[0].v
        .coupons.length,
      1,
    );
    await assert.rejects(
      db.exec("update coupon_audit_logs set action='forged'"),
      /permission denied/,
    );
    await assert.rejects(
      db.exec("delete from coupon_audit_logs"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});

test("percent and fixed USD discounts compute trusted catalog totals and equal unit rounding", async () => {
  const { db, user } = await fixture();
  try {
    await save(db, user);
    const q = await quote(db, user);
    assert.equal(q.paymentTotal, 800);
    assert.equal(q.discountUsdCents, 200);
    assert.deepEqual(
      Object.keys(q).sort(),
      [
        "id",
        "code",
        "currency",
        "paymentTotal",
        "discountTotal",
        "discountUsdCents",
        "expiresAt",
      ].sort(),
    );
    await save(db, user, { code: "FIXED101", kind: "fixed", value: 101 });
    const fixed = await quote(db, user, "FIXED101", { lines: cart(3) });
    assert.equal(fixed.discountUsdCents, 99);
    assert.equal(fixed.paymentTotal, 2901);
    assert.equal(
      (
        await quote(db, user, "TRAVEL20", {
          lines: [{ ...cart()[0], unitAmount: 1 }],
        })
      ).error,
      "invalid_coupon",
    );
    const id = await order(db, user, 3);
    await prepare(db, id, fixed);
    assert.deepEqual(
      (
        await db.query(
          "select unit_amount,payment_unit_amount from checkout_order_items where order_id=$1",
          [id],
        )
      ).rows[0],
      { unit_amount: 1000, payment_unit_amount: 967 },
    );
    assert.equal(
      (await db.query("select count(*)::int n from simcoins_order_snapshots"))
        .rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});

test("margin includes fresh supplier cost, conservative affiliate, Stripe fee and fixed transaction fee", async () => {
  const { db, user } = await fixture();
  try {
    await save(db, user, { value: 5000 });
    assert.equal((await quote(db, user)).paymentTotal, 500); // explicit campaigns may exceed 5%
    await db.exec(
      "update simcoins_private_costs set wholesale_unit_units=35000",
    );
    assert.equal((await quote(db, user)).error, "coupon_margin");
    await db.exec(
      "update simcoins_private_costs set wholesale_unit_units=10000,observed_at=now()-interval '16 minutes'",
    );
    assert.equal((await quote(db, user)).error, "coupon_cost_unavailable");
    await db.exec("update simcoins_private_costs set observed_at=now()");
    const q = await quote(db, user),
      id = await order(db, user);
    await db.exec(
      "update simcoins_private_costs set wholesale_unit_units=49000",
    );
    await assert.rejects(prepare(db, id, q), /coupon_insufficient_margin/);
    assert.equal(
      (await db.query("select count(*)::int n from coupon_usage_reservations"))
        .rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});

test("FX quote uses per-unit integer conversion and preserves gross USD history", async () => {
  const { db, user } = await fixture();
  try {
    await save(db, user, { kind: "fixed", value: 101 });
    const fx = randomUUID();
    await db.query(
      "insert into fx_snapshots(id,provider_ref,rates,sampled_at)values($1,'fxq_fixture',$2,now())",
      [fx, { JPY: "1501234567890" }],
    );
    const q = await quote(db, user, "TRAVEL20", {
      currency: "JPY",
      fx,
      lines: cart(3),
    });
    assert.equal(q.paymentTotal, 4356);
    assert.equal(q.discountUsdCents, 99);
    const id = await order(db, user, 3),
      prepared = await prepare(db, id, q, identity, fx);
    assert.equal(prepared.amount_total, 3000);
    assert.equal(prepared.payment_total, 4356);
    await assert.rejects(
      prepare(db, id, q, identity, null),
      /coupon_attempt_conflict/,
    );
    await db.exec(
      "update fx_snapshots set expires_at=now()-interval '1 second'",
    );
    assert.equal(
      (await quote(db, user, "TRAVEL20", { currency: "JPY", fx })).error,
      "coupon_expired",
    );
    const coarseFx = randomUUID();
    await db.query(
      "insert into fx_snapshots(id,provider_ref,rates,sampled_at)values($1,'fxq_coarse',$2,now())",
      [coarseFx, { JPY: "1000000000" }],
    );
    await save(db, user, { code: "TINYFIXED", kind: "fixed", value: 1 });
    assert.equal(
      (await quote(db, user, "TINYFIXED", { currency: "JPY", fx: coarseFx }))
        .error,
      "coupon_margin",
    ); // zero visible savings after FX rounding
  } finally {
    await db.close();
  }
});

test("test-mode orders cannot consume live coupon capacity or bypass the guard on retries", async () => {
  const { db, user } = await fixture();
  try {
    await save(db, user, { max_uses: 1 });
    const q = await quote(db, user);
    const testOrder = await order(db, user);
    await db.query("update checkout_orders set livemode=false where id=$1", [
      testOrder,
    ]);
    await assert.rejects(
      prepare(db, testOrder, q),
      /coupon_live_mode_required/,
    );
    assert.equal(
      (await db.query("select count(*)::int n from coupon_usage_reservations"))
        .rows[0].n,
      0,
    );
    const liveOrder = await order(db, user);
    await prepare(db, liveOrder, q);
    assert.equal(
      (await db.query("select count(*)::int n from coupon_usage_reservations"))
        .rows[0].n,
      1,
    );
    await db.query("update checkout_orders set livemode=false where id=$1", [
      liveOrder,
    ]);
    await assert.rejects(
      prepare(db, liveOrder, q),
      /coupon_live_mode_required/,
    );
  } finally {
    await db.close();
  }
});

test("coupon preparation rejects SimCoins snapshots and independently prepared payment amounts", async () => {
  const { db, user } = await fixture();
  try {
    await save(db, user);
    const q = await quote(db, user),
      id = await order(db, user),
      account = randomUUID(),
      coinsQuote = randomUUID();
    await db.query("insert into simcoins_accounts(id,user_id)values($1,$2)", [
      account,
      user,
    ]);
    await db.query(
      "insert into simcoins_quotes(id,account_id,cart_hash,currency,snapshot)values($1,$2,$3,'USD','{}')",
      [coinsQuote, account, identity],
    );
    await db.query(
      "insert into simcoins_order_snapshots(order_id,account_id,quote_id,policy_version,snapshot,release_delay_seconds)values($1,$2,$3,1,'{}',0)",
      [id, account, coinsQuote],
    );
    await assert.rejects(prepare(db, id, q), /coupon_order_ineligible/);
    const other = await order(db, user);
    await db.query("select prepare_checkout_payment($1,'USD',null,1000)", [
      other,
    ]);
    await assert.rejects(prepare(db, other, q), /coupon_order_ineligible/);
  } finally {
    await db.close();
  }
});

test("quotes bind identity, user, exact cart, current version, dates and expiration", async () => {
  const { db, user } = await fixture();
  try {
    const c = await save(db, user);
    const q = await quote(db, user),
      id = await order(db, user);
    await assert.rejects(prepare(db, id, q, otherIdentity), /coupon_identity/);
    const wrongOwner = await order(db, null);
    await assert.rejects(prepare(db, wrongOwner, q), /coupon_identity/);
    const wrongCart = await order(db, user, 2);
    await assert.rejects(prepare(db, wrongCart, q), /coupon_cart_changed/);
    await save(db, user, { id: c.id, value: 1900 });
    await assert.rejects(prepare(db, id, q), /coupon_quote_changed/);
    const fresh = await quote(db, user);
    await db.query(
      "update coupon_quotes set expires_at=now()-interval '1 second'where id=$1",
      [fresh.id],
    );
    await assert.rejects(prepare(db, id, fresh), /coupon_quote_expired/);
    await save(db, user, {
      id: c.id,
      starts_at: new Date(Date.now() + 86400000).toISOString(),
    });
    assert.equal((await quote(db, user)).error, "invalid_coupon");
    await save(db, user, {
      id: c.id,
      starts_at: null,
      ends_at: new Date(Date.now() - 86400000).toISOString(),
    });
    assert.equal((await quote(db, user)).error, "invalid_coupon");
  } finally {
    await db.close();
  }
});

test("reservations enforce global and customer limits, preserve snapshots, release terminal holds and record late payment", async () => {
  const { db, user } = await fixture();
  try {
    const c = await save(db, user, { max_uses: 2, max_uses_per_customer: 1 });
    const q1 = await quote(db, user),
      q2 = await quote(db, user),
      o1 = await order(db, user),
      o2 = await order(db, user);
    const result = await Promise.allSettled([
      prepare(db, o1, q1),
      prepare(db, o2, q2),
    ]);
    assert.equal(result.filter((x) => x.status === "fulfilled").length, 1);
    assert.match(
      result.find((x) => x.status === "rejected").reason.message,
      /coupon_limit_reached/,
    );
    await prepare(db, o1, q1);
    assert.equal(
      (await db.query("select count(*)::int n from coupon_usage_reservations"))
        .rows[0].n,
      1,
    );
    assert.equal(
      (await quote(db, user, "TRAVEL20", { identity: otherIdentity })).error,
      "coupon_limit",
    );
    await db.query(
      "update checkout_orders set status='failed',payment_in_progress=true where id=$1",
      [o1],
    );
    assert.equal((await quote(db, user)).error, "coupon_limit");
    await db.query(
      "update checkout_orders set payment_in_progress=false where id=$1",
      [o1],
    );
    const q3 = await quote(db, user);
    assert.ok(q3.id);
    await prepare(db, o2, q3);
    await db.query("update checkout_orders set status='paid'where id=$1", [o1]); // authoritative late payment
    await db.query("update checkout_orders set status='paid'where id=$1", [o2]);
    await assert.rejects(
      save(db, user, { id: c.id, max_uses: 1 }),
      /coupon_limit_below_usage/,
    );
    const original = (
      await db.query(
        "select snapshot from coupon_order_snapshots where order_id=$1",
        [o1],
      )
    ).rows[0].snapshot;
    await save(db, user, { id: c.id, value: 1000, max_uses_per_customer: 2 });
    await save(db, user, { id: c.id }, randomUUID(), "archive");
    assert.equal((await quote(db, user)).error, "invalid_coupon");
    await assert.rejects(save(db, user), /duplicate key/);
    assert.deepEqual(
      (
        await db.query(
          "select snapshot from coupon_order_snapshots where order_id=$1",
          [o1],
        )
      ).rows[0].snapshot,
      original,
    );
    await assert.rejects(
      db.query(
        "update coupon_order_snapshots set snapshot='{}'where order_id=$1",
        [o1],
      ),
      /coupon_snapshot_immutable/,
    );
    const summary = (
      await db.query("select coupon_admin_snapshot($1)v", [user])
    ).rows[0].v.summary;
    assert.equal(summary.redeemed, 2);
    assert.equal(summary.discountUsdCents, 400);
    assert.equal(summary.active, 0);
    assert.deepEqual(
      (
        await db.query(
          "select state,count(*)::int n from coupon_usage_reservations group by state",
        )
      ).rows,
      [{ state: "redeemed", n: 2 }],
    );
  } finally {
    await db.close();
  }
});

test("global caps serialize distinct guest attempts and released slots become available", async () => {
  const { db, user } = await fixture();
  try {
    await save(db, user, { max_uses: 1 });
    const q1 = await quote(db, null),
      q2 = await quote(db, null, "TRAVEL20", {
        identity: otherIdentity,
        rateKey: otherIdentity,
      });
    const o1 = await order(db, null),
      o2 = await order(db, null);
    await prepare(db, o1, q1);
    await assert.rejects(
      prepare(db, o2, q2, otherIdentity),
      /coupon_limit_reached/,
    );
    await db.query("update checkout_orders set status='expired' where id=$1", [
      o1,
    ]);
    await prepare(db, o2, q2, otherIdentity);
    await db.query("update checkout_orders set status='paid' where id=$1", [
      o2,
    ]);
    assert.equal((await quote(db, null)).error, "coupon_limit");
  } finally {
    await db.close();
  }
});

test("invalid guesses consume a persistent rate bucket; retrying prepared orders survives coupon edits", async () => {
  const { db, user } = await fixture();
  try {
    const c = await save(db, user),
      q = await quote(db, user),
      id = await order(db, user);
    await prepare(db, id, q);
    await save(db, user, { id: c.id, active: false });
    await prepare(db, id, q);
    for (let n = 0; n < 19; n++)
      assert.equal((await quote(db, user, "NOTREAL")).error, "invalid_coupon");
    assert.equal((await quote(db, user, "NOTREAL")).error, "rate_limit");
    assert.equal(
      (await db.query("select attempts from coupon_rate_limits")).rows[0]
        .attempts,
      21,
    );
    await db.exec(
      "update coupon_rate_limits set window_start=now()-interval '11 minutes'",
    );
    assert.equal((await quote(db, user, "NOTREAL")).error, "invalid_coupon");
    assert.equal(
      (await db.query("select attempts from coupon_rate_limits")).rows[0]
        .attempts,
      1,
    );
  } finally {
    await db.close();
  }
});
