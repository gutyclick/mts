import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  paymentEnvironment,
  paymentMode,
  paymentFormMatchesMode,
} from "../src/lib/payments/checkout-mode.ts";
import { verifyPaymentSnapshot } from "../src/lib/payments/checkout-core.ts";
import { verifyHoldSession } from "../src/lib/payments/hold-policy.ts";
import {
  syncStripeCatalog,
  liveSecret,
} from "../scripts/lib/stripe-catalog.mjs";

test("payment environments select independent keys and never infer live from a test flag", () => {
  assert.equal(paymentMode({ STRIPE_TEST_CHECKOUT_ENABLED: "true" }), "test");
  assert.throws(() => paymentMode({ CHECKOUT_PAYMENT_MODE: "production" }));
  const env = {
    CHECKOUT_PAYMENT_MODE: "live",
    STRIPE_LIVE_SECRET_KEY: "live-secret",
    STRIPE_TEST_SECRET_KEY: "test-secret",
  };
  assert.equal(paymentEnvironment(env).secret, "live-secret");
  assert.equal(paymentEnvironment(env, "test").secret, "test-secret");
  assert.throws(() => liveSecret("sk_test_" + "x".repeat(24)));
});

test("browser accepts live payment forms and rejects mixed Stripe environments", () => {
  assert.equal(
    paymentFormMatchesMode(
      "cs_live_order_secret_one",
      "pk_live_public",
      "live",
    ),
    true,
  );
  assert.equal(
    paymentFormMatchesMode(
      "cs_test_order_secret_one",
      "pk_test_public",
      "test",
    ),
    true,
  );
  assert.equal(
    paymentFormMatchesMode(
      "cs_live_order_secret_one",
      "pk_test_public",
      "live",
    ),
    false,
  );
  assert.equal(
    paymentFormMatchesMode(
      "cs_test_order_secret_one",
      "pk_live_public",
      "live",
    ),
    false,
  );
  assert.equal(paymentFormMatchesMode(null, "pk_live_public", "live"), false);
});

test("paid snapshots and expiry reconciliation bind the order environment", () => {
  const order = {
    id: randomUUID(),
    livemode: true,
    amount_total: 500,
    stripe_session_id: "cs_live_order",
    items: [{ stripe_price_id: "price_live", quantity: 1, unit_amount: 500 }],
  };
  const session = {
    id: order.stripe_session_id,
    livemode: true,
    mode: "payment",
    client_reference_id: order.id,
    metadata: { mts_order_id: order.id },
    currency: "usd",
    amount_total: 500,
  };
  const lines = [{ priceId: "price_live", quantity: 1, amount: 500 }];
  verifyPaymentSnapshot(order, session, lines);
  verifyHoldSession(order, session);
  assert.throws(() =>
    verifyPaymentSnapshot(order, { ...session, livemode: false }, lines),
  );
  assert.throws(() =>
    verifyHoldSession(order, { ...session, livemode: false }),
  );
  assert.throws(() =>
    verifyPaymentSnapshot({ ...order, livemode: false }, session, lines),
  );
});

test("live catalog import is explicit, idempotent and rejects test responses", async () => {
  const products = new Map(),
    prices = new Map();
  const stripe = {
    products: {
      async *list() {
        yield* products.values();
      },
      async create(p) {
        const result = { ...p, active: true, livemode: true };
        products.set(p.id, result);
        return result;
      },
      async update(id, update) {
        Object.assign(products.get(id), update);
        return products.get(id);
      },
    },
    prices: {
      async *list() {
        yield* prices.values();
      },
      async create(p) {
        const result = {
          ...p,
          id: "price_live_one",
          active: true,
          livemode: true,
          type: "one_time",
        };
        prices.set(p.lookup_key, result);
        return result;
      },
    },
  };
  const rows = [
    {
      planId: "PA_1_7",
      productId: "mts_one",
      lookupKey: "mts_one_500",
      unitAmount: 500,
      name: "Panama 1 GB",
      destination: "panama",
    },
  ];
  const first = await syncStripeCatalog(stripe, rows, undefined, true);
  assert.deepEqual(
    await syncStripeCatalog(stripe, rows, undefined, true),
    first,
  );
  assert.equal(products.size, 1);
  assert.equal(prices.size, 1);
  await assert.rejects(syncStripeCatalog(stripe, rows), /environment/);
});

test("live orders use live prices, require stock, remain private and enqueue each eSIM once", async () => {
  const db = new PGlite();
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
      "20261025000500_payment_holds.sql",
      "20261025000900_esim_fulfillment.sql",
      "20261026000100_live_checkout.sql",
    ])
      await db.exec(
        readFileSync(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    await db.exec(`insert into catalog_destinations(slug,name,code,type,image,artwork_kind,is_published) values('panama','{"es":"Panamá","en":"Panama"}','PA','country','/flags/pa.svg','flag',true);
      insert into catalog_plans(id,destination_slug,name,allowance,data_gb,days,coverage_code,is_published,retail_price_cents) values('PA_1_7','panama','Panama 1GB 7Days','1GB',1,7,'PA',true,500);
      insert into stripe_catalog_prices(plan_id,product_id,price_id,amount_cents,livemode) values('PA_1_7','mts_one','price_test',500,false),('PA_1_7','mts_one','price_live',500,true);`);
    const id = randomUUID();
    const create = (live = true, orderId = id, total = 1000) =>
      db.query(
        "select create_checkout_v3($1,$2,null,$3,$3,false,$4,$5,$6,'es',$7,$8::jsonb) as result",
        [
          live,
          orderId,
          "recipient@example.invalid",
          "a".repeat(64),
          "b".repeat(64),
          "c".repeat(64),
          total,
          JSON.stringify([
            { destination: "panama", planId: "PA_1_7", quantity: 2 },
          ]),
        ],
      );
    await db.exec("set role anon");
    await assert.rejects(create(), /permission denied/);
    await db.exec("reset role");
    await assert.rejects(create(), /unavailable_plan/);
    await db.exec(
      "insert into provider_package_bindings(plan_id,provider_slug,package_code,volume_bytes,days) values('PA_1_7','PA_1_7','PKG1',1073741824,7)",
    );
    await assert.rejects(create(true, randomUUID(), 1), /price_changed/);
    assert.equal((await create()).rows[0].result.livemode, true);
    await create();
    await assert.rejects(create(false), /attempt_conflict/);
    assert.equal(
      (
        await db.query(
          "select stripe_price_id from checkout_order_items where order_id=$1",
          [id],
        )
      ).rows[0].stripe_price_id,
      "price_live",
    );
    await db.query(
      "update checkout_orders set stripe_session_id='cs_live_order' where id=$1",
      [id],
    );
    const record = (mode = true) =>
      db.query(
        "select record_checkout_event_v2($1,'evt_live','checkout.session.completed',$2,'cs_live_order','paid',1000,'usd','pi_live') as result",
        [mode, id],
      );
    await assert.rejects(record(false), /payment_mismatch/);
    assert.equal((await record()).rows[0].result, "recorded");
    assert.equal((await record()).rows[0].result, "duplicate");
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from esim_fulfillments where order_id=$1 and state='queued'",
          [id],
        )
      ).rows[0].n,
      2,
    );
    const testId = randomUUID();
    await create(false, testId);
    assert.equal(
      (
        await db.query(
          "select stripe_price_id from checkout_order_items where order_id=$1",
          [testId],
        )
      ).rows[0].stripe_price_id,
      "price_test",
    );
    await db.query(
      "update checkout_orders set stripe_session_id='cs_test_order' where id=$1",
      [testId],
    );
    await db.query(
      "select record_checkout_event_v2(false,'evt_test','checkout.session.completed',$1,'cs_test_order','paid',1000,'usd','pi_test')",
      [testId],
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from esim_fulfillments where order_id=$1 and state='test_skipped'",
          [testId],
        )
      ).rows[0].n,
      2,
    );
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select * from checkout_orders"),
      /permission denied/,
    );
  } finally {
    await db.close();
  }
});
