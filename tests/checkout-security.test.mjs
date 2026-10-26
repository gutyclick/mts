import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import Stripe from "stripe";
import { equivalentPath } from "../src/lib/i18n.ts";
import { safeAccountNext } from "../src/lib/auth-routes.ts";
import { legalVersion } from "../src/lib/legal-version.ts";
import {
  checkoutRequestSchema,
  verifyPaymentSnapshot,
  checkoutOrigin,
  sha256,
  sameHash,
} from "../src/lib/payments/checkout-core.ts";

test("checkout rejects forged prices, IDs and missing consent; origins and guest tokens are strict", () => {
  assert.equal(
    equivalentPath("/es/checkout/result", "en"),
    "/en/checkout/result",
  );
  const receiptId = randomUUID();
  assert.equal(
    safeAccountNext(
      `/es/checkout/result?order=${receiptId}&next=https://evil.example`,
      "es",
    ),
    `/es/checkout/result?order=${receiptId}`,
  );
  assert.equal(
    safeAccountNext("/es/checkout/result?order=bad", "es"),
    "/es/mis-esim",
  );
  const valid = {
    attemptId: randomUUID(),
    locale: "es",
    email: "test@example.invalid",
    lines: [{ destination: "japan", planId: "JP_1_7", quantity: 1 }],
    expectedTotal: 400,
    compatible: true,
    terms: true,
    legalVersion,
  };
  assert.ok(checkoutRequestSchema.safeParse(valid).success);
  assert.equal(checkoutRequestSchema.parse(valid).marketingOptIn, false);
  assert.ok(
    !checkoutRequestSchema.safeParse({ ...valid, differentRecipient: true })
      .success,
  );
  assert.ok(
    !checkoutRequestSchema.safeParse({ ...valid, marketingOptIn: "true" })
      .success,
  );
  assert.ok(
    checkoutRequestSchema.safeParse({
      ...valid,
      differentRecipient: true,
      recipientEmail: "recipient@example.invalid",
      marketingOptIn: true,
    }).success,
  );
  for (const changed of [
    { ...valid, priceId: "forged" },
    { ...valid, terms: false },
    { ...valid, legalVersion: undefined },
    { ...valid, legalVersion: "old-version" },
    { ...valid, compatible: false },
    { ...valid, expectedTotal: 0 },
    { ...valid, lines: [] },
    { ...valid, lines: [{ ...valid.lines[0], unitAmount: 1 }] },
  ])
    assert.ok(!checkoutRequestSchema.safeParse(changed).success);
  assert.equal(
    checkoutOrigin("http://localhost:3000"),
    "http://localhost:3000",
  );
  for (const origin of [
    "http://evil.example",
    "https://user:pass@example.com",
    "https://example.com/evil",
    "https://example.com/?next=evil",
  ])
    assert.throws(() => checkoutOrigin(origin));
  assert.ok(sameHash(sha256("one"), sha256("one")));
  assert.ok(!sameHash(sha256("one"), sha256("two")));
});

test("payment verification binds session, order, currency, amounts and every line", () => {
  const id = randomUUID();
  const order = {
    id,
    amount_total: 800,
    stripe_session_id: "cs_test_one",
    items: [{ stripe_price_id: "price_one", quantity: 2, unit_amount: 400 }],
  };
  const session = {
    id: "cs_test_one",
    livemode: false,
    mode: "payment",
    client_reference_id: id,
    metadata: { mts_order_id: id },
    currency: "usd",
    amount_total: 800,
  };
  const lines = [{ priceId: "price_one", quantity: 2, amount: 800 }];
  verifyPaymentSnapshot(order, session, lines);
  for (const altered of [
    { ...session, livemode: true },
    { ...session, amount_total: 1 },
    { ...session, currency: "eur" },
    { ...session, client_reference_id: randomUUID() },
    { ...session, metadata: {} },
  ])
    assert.throws(() => verifyPaymentSnapshot(order, altered, lines));
  for (const altered of [
    [],
    [...lines, ...lines],
    [{ ...lines[0], priceId: "price_foreign" }],
    [{ ...lines[0], quantity: 1 }],
  ])
    assert.throws(() => verifyPaymentSnapshot(order, session, altered));
});

test("Stripe signatures reject forged, modified and expired payloads", () => {
  const stripe = new Stripe("sk_test_" + "x".repeat(24));
  const secret = "whsec_" + "x".repeat(32);
  const payload = JSON.stringify({
    id: "evt_test",
    type: "checkout.session.completed",
    livemode: false,
    data: { object: {} },
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  assert.equal(
    stripe.webhooks.constructEvent(payload, signature, secret).id,
    "evt_test",
  );
  assert.throws(() =>
    stripe.webhooks.constructEvent(payload + " ", signature, secret),
  );
  const expired = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    timestamp: Math.floor(Date.now() / 1000) - 600,
  });
  assert.throws(() => stripe.webhooks.constructEvent(payload, expired, secret));
});

test("orders are atomic, private, idempotent, rate limited and only confirmed once", async () => {
  const db = new PGlite();
  const owner = randomUUID(),
    stranger = randomUUID(),
    id = randomUUID();
  const browser = "a".repeat(64),
    fingerprint = "b".repeat(64),
    ip = "c".repeat(64);
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key); grant usage on schema auth to authenticated;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
    for (const file of [
      "20261024000100_catalog.sql",
      "20261025000100_retail_prices.sql",
      "20261025000300_test_checkout.sql",
      "20261025000400_checkout_recipient_and_elements.sql",
    ])
      await db.exec(
        readFileSync(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(`insert into auth.users values('${owner}'),('${stranger}');
      insert into catalog_destinations(slug,name,code,type,image,artwork_kind,is_published) values('japan','{"es":"Japón","en":"Japan"}','JP','country','/flags/jp.svg','flag',true);
      insert into catalog_plans(id,destination_slug,name,allowance,data_gb,days,coverage_code,is_published,retail_price_cents) values('JP_1_7','japan','Japan 1GB 7Days','1GB',1,7,'JP',true,400);
      insert into stripe_catalog_prices(plan_id,product_id,price_id,amount_cents) values('JP_1_7','prod_one','price_one',400);`);
    const lines = JSON.stringify([
      { destination: "japan", planId: "JP_1_7", quantity: 2 },
    ]);
    const create = (
      orderId = id,
      user = owner,
      email = "private@example.invalid",
      fp = fingerprint,
      total = 800,
      cart = lines,
      ipHash = ip,
    ) =>
      db.query(
        "select public.create_test_checkout($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) as result",
        [orderId, user, email, browser, ipHash, fp, "es", total, cart],
      );
    await db.exec("set role anon");
    await assert.rejects(create(), /permission denied/);
    await assert.rejects(
      db.query("select * from stripe_catalog_prices"),
      /permission denied/,
    );
    await db.exec("reset role; set role service_role");
    await assert.rejects(
      create(randomUUID(), owner, "private@example.invalid", fingerprint, 1),
      /price_changed/,
    );
    assert.equal(
      (await db.query("select count(*)::int as count from checkout_orders"))
        .rows[0].count,
      0,
    );
    await create();
    await create();
    assert.equal(
      (await db.query("select count(*)::int as count from checkout_orders"))
        .rows[0].count,
      1,
    );
    await assert.rejects(
      create(id, owner, "other@example.invalid", "d".repeat(64)),
      /attempt_conflict/,
    );
    const guest = randomUUID();
    await create(guest, null);
    await db.exec("reset role; set role authenticated");
    for (const [user, count] of [
      [owner, 1],
      [stranger, 0],
    ]) {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        user,
      ]);
      assert.equal(
        (await db.query("select id,status from checkout_orders")).rows.length,
        count,
      );
      assert.equal(
        (await db.query("select plan_id from checkout_order_items")).rows
          .length,
        count,
      );
      await assert.rejects(
        db.query("select recipient_email from checkout_orders"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select browser_hash from checkout_orders"),
        /permission denied/,
      );
      await assert.rejects(
        db.exec("update checkout_orders set status='paid' where true"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select * from checkout_stripe_events"),
        /permission denied/,
      );
    }
    await db.exec("reset role; set role service_role");
    await db.query(
      "update checkout_orders set stripe_session_id='cs_test_one' where id=$1",
      [id],
    );
    const record = (
      event,
      status = "paid",
      amount = 800,
      currency = "usd",
      session = "cs_test_one",
      type = "checkout.session.completed",
    ) =>
      db.query(
        "select record_test_checkout_event($1,$2,$3,$4,$5,$6,$7,$8) as result",
        [event, type, id, session, status, amount, currency, "pi_one"],
      );
    await assert.rejects(record("evt_bad", "paid", 1), /payment_mismatch/);
    await assert.rejects(
      record("evt_bad", "paid", 800, "eur"),
      /payment_mismatch/,
    );
    await assert.rejects(
      record("evt_bad", "paid", 800, "usd", "cs_foreign"),
      /payment_mismatch/,
    );
    assert.equal((await record("evt_one")).rows[0].result, "recorded");
    assert.equal((await record("evt_one")).rows[0].result, "duplicate");
    await record(
      "evt_expired",
      "expired",
      800,
      "usd",
      "cs_test_one",
      "checkout.session.expired",
    );
    assert.equal(
      (await db.query("select status from checkout_orders where id=$1", [id]))
        .rows[0].status,
      "paid",
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as count from checkout_stripe_events",
        )
      ).rows[0].count,
      2,
    );
    for (let i = 0; i < 13; i++) await create(randomUUID(), null);
    await assert.rejects(create(randomUUID(), null), /checkout_rate_limit/);
    // No client or test event can turn this infrastructure into live payment handling.
    await assert.rejects(
      db.query("update checkout_orders set livemode=true where id=$1", [id]),
      /check constraint/,
    );
    const alternateId = randomUUID();
    const alternate = (optIn = true) =>
      db.query(
        "select create_test_checkout_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::jsonb) as result",
        [
          alternateId,
          null,
          "buyer@example.invalid",
          "recipient@example.invalid",
          optIn,
          browser,
          "e".repeat(64),
          fingerprint,
          "es",
          800,
          lines,
        ],
      );
    const first = (await alternate()).rows[0].result;
    assert.equal(first.billing_email, "buyer@example.invalid");
    assert.equal(first.recipient_email, "recipient@example.invalid");
    assert.equal(first.marketing_opt_in, true);
    assert.equal(first.marketing_consent_version, "mytripsim-news-v1");
    assert.equal(first.checkout_ui_mode, "elements");
    assert.ok(first.marketing_opt_in_at);
    assert.equal(
      (await alternate()).rows[0].result.marketing_opt_in_at,
      first.marketing_opt_in_at,
    );
    await assert.rejects(alternate(false), /attempt_conflict/);
    await db.exec("reset role; set role authenticated");
    for (const column of [
      "billing_email",
      "recipient_email",
      "marketing_opt_in",
      "marketing_opt_in_at",
    ])
      await assert.rejects(
        db.query(`select ${column} from checkout_orders`),
        /permission denied/,
      );
    await assert.rejects(alternate(), /permission denied/);
  } finally {
    await db.close();
  }
});
