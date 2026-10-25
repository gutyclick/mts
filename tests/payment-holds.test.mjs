import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  PAYMENT_HOLD_MS,
  remainingHoldSeconds,
  closeUnpaidCheckout,
} from "../src/lib/payments/hold-policy.ts";
test("hold countdown is five minutes and cannot gain time from a reload", () => {
  const start = Date.parse("2026-10-25T18:00:00Z"),
    deadline = new Date(start + PAYMENT_HOLD_MS).toISOString();
  assert.equal(remainingHoldSeconds(deadline, start), 300);
  assert.equal(remainingHoldSeconds(deadline, start + 120000), 180);
  assert.equal(remainingHoldSeconds(deadline, start + 300001), 0);
  assert.equal(remainingHoldSeconds(null, start), null);
});
test("Stripe expiry wins only for an unpaid session; a concurrent payment is preserved", async () => {
  const order = {
    id: randomUUID(),
    stripe_session_id: "cs_test_hold",
    amount_total: 300,
  };
  const open = {
    id: order.stripe_session_id,
    livemode: false,
    status: "open",
    payment_status: "unpaid",
    client_reference_id: order.id,
    metadata: { mts_order_id: order.id },
    currency: "usd",
    amount_total: 300,
  };
  let expired = 0;
  assert.equal(
    await closeUnpaidCheckout(order, {
      retrieve: async () => open,
      expire: async () => {
        expired++;
        return { ...open, status: "expired" };
      },
    }),
    "cancelled",
  );
  assert.equal(expired, 1);
  let reads = 0;
  assert.equal(
    await closeUnpaidCheckout(order, {
      retrieve: async () =>
        ++reads === 1
          ? open
          : { ...open, status: "complete", payment_status: "paid" },
      expire: async () => {
        throw new Error("Payment already completed");
      },
    }),
    "processing",
  );
  assert.equal(
    await closeUnpaidCheckout(order, {
      retrieve: async () => ({
        ...open,
        status: "complete",
        payment_status: "unpaid",
      }),
      expire: async () => {
        throw new Error("Must not expire processing payments");
      },
    }),
    "processing",
  );
  await assert.rejects(
    closeUnpaidCheckout(order, {
      retrieve: async () => ({ ...open, livemode: true }),
      expire: async () => open,
    }),
    /identity/,
  );
  await assert.rejects(
    closeUnpaidCheckout(order, {
      retrieve: async () => ({ ...open, client_reference_id: randomUUID() }),
      expire: async () => open,
    }),
    /identity/,
  );
  await assert.rejects(
    closeUnpaidCheckout(order, {
      retrieve: async () => open,
      expire: async () => {
        throw new Error("Offline");
      },
    }),
    /could not be closed/,
  );
});
test("server hold deadlines are immutable, private and claimed once; paid orders survive late cancellation events", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);grant usage on schema auth to authenticated;create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;",
    );
    for (const migration of [
      "20261024000100_catalog.sql",
      "20261025000100_retail_prices.sql",
      "20261025000300_test_checkout.sql",
      "20261025000400_checkout_recipient_and_elements.sql",
      "20261025000500_payment_holds.sql",
    ])
      await db.exec(
        readFileSync(
          new URL(`../supabase/migrations/${migration}`, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261025000800_signed_expiry_jobs.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const id = randomUUID(),
      stale = randomUUID();
    for (const value of [id, stale])
      await db.query(
        "insert into checkout_orders(id,recipient_email,browser_hash,ip_hash,fingerprint,locale,amount_total,stripe_session_id) values($1,'hold@example.invalid',$2,$2,$2,'es',300,$3)",
        [value, "a".repeat(64), `cs_${value}`],
      );
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select touch_checkout_payment($1,'leave')", [id]),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select * from claim_checkout_expirations(20)"),
      /permission denied/,
    );
    await db.exec("reset role;set role service_role");
    const ticket = randomUUID(),
      issued = Math.floor(Date.now() / 1000);
    await db.query(
      "insert into checkout_expiry_tickets(id,issued_at) values($1,to_timestamp($2))",
      [ticket, issued],
    );
    assert.equal(
      (
        await db.query(
          "select consume_checkout_expiry_ticket($1,$2) as consumed",
          [ticket, issued],
        )
      ).rows[0].consumed,
      true,
    );
    assert.equal(
      (
        await db.query(
          "select consume_checkout_expiry_ticket($1,$2) as consumed",
          [ticket, issued],
        )
      ).rows[0].consumed,
      false,
    );
    const touch = async (action) =>
      (
        await db.query("select touch_checkout_payment($1,$2) as data", [
          id,
          action,
        ])
      ).rows[0].data;
    await touch("active");
    const first = await touch("leave");
    const again = await touch("active");
    const leaveAgain = await touch("leave");
    assert.equal(
      new Date(first.payment_hold_expires_at) -
        new Date(first.payment_hold_started_at),
      PAYMENT_HOLD_MS,
    );
    assert.equal(again.payment_hold_expires_at, first.payment_hold_expires_at);
    assert.equal(
      leaveAgain.payment_hold_expires_at,
      first.payment_hold_expires_at,
    );
    await db.query(
      "update checkout_orders set payment_last_seen_at=now()-interval '10 minutes' where id=$1",
      [stale],
    );
    assert.equal(
      (await db.query("select start_stale_checkout_holds() as count")).rows[0]
        .count,
      1,
    );
    assert.deepEqual(
      (await db.query("select * from claim_checkout_expirations(20) as id"))
        .rows,
      [{ id: stale }],
    );
    assert.equal(
      (await db.query("select * from claim_checkout_expirations(20)")).rows
        .length,
      0,
    );
    const record = (event, status, type) =>
      db.query(
        "select record_test_checkout_event($1,$2,$3,$4,$5,300,'usd','pi_hold')",
        [event, type, stale, `cs_${stale}`, status],
      );
    await record("evt_expired", "expired", "checkout.session.expired");
    assert.equal(
      (
        await db.query("select status from checkout_orders where id=$1", [
          stale,
        ])
      ).rows[0].status,
      "cancelled",
    );
    await record("evt_paid", "paid", "checkout.session.completed");
    await record("evt_late", "expired", "checkout.session.expired");
    assert.equal(
      (
        await db.query("select status from checkout_orders where id=$1", [
          stale,
        ])
      ).rows[0].status,
      "paid",
    );
    await db.exec("reset role;set role authenticated");
    await assert.rejects(
      db.query("select payment_last_seen_at from checkout_orders"),
      /permission denied/,
    );
    assert.equal(
      (await db.query("select payment_hold_expires_at from checkout_orders"))
        .rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
