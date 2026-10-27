// Local server + Stripe TEST sessions only. Never confirms payment or emits eSIMs.
import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { currencies, convertUsdMinor } from "../src/lib/currency.ts";
import { legalVersion } from "../src/lib/legal-version.ts";
import { verifyPaymentSnapshot } from "../src/lib/payments/checkout-core.ts";
process.loadEnvFile(".env.local");
const base = process.env.CURRENCY_TEST_BASE ?? "http://localhost:3000";
if (
  !/^http:\/\/localhost:\d+$/.test(base) ||
  !/^(sk|rk)_test_[A-Za-z0-9]{16,}$/.test(
    process.env.STRIPE_TEST_SECRET_KEY ?? "",
  )
)
  throw Error("Local server and test key required");
const stripe = new Stripe(process.env.STRIPE_TEST_SECRET_KEY, {
    timeout: 15000,
    maxNetworkRetries: 0,
  }),
  db = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_CHECKOUT_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  ),
  jar = new Map(),
  fixtures = [];
const startedAt=Math.floor(Date.now()/1000);
const nonce = randomBytes(8).toString("hex"),
  email = `qa-currency-${nonce}@example.invalid`;
mkdirSync("private-data", { recursive: true });
const journal = () =>
  writeFileSync(
    "private-data/currency-test-fixtures.json",
    JSON.stringify({ stage, fixtures }, null, 2),
  );
const cookie = () => [...jar].map(([k, v]) => k + "=" + v).join("; ");
function check(error) {
  if (error) throw Error("Fixture operation unavailable");
}
function capture(r) {
  for (const entry of r.headers.getSetCookie()) {
    const field = entry.split(";")[0],
      split = field.indexOf("="),
      name = field.slice(0, split),
      value = field.slice(split + 1);
    if (value) jar.set(name, value);
    else jar.delete(name);
  }
}
async function request(path, body, index = 0) {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      origin: base,
      cookie: cookie(),
      "content-type": "application/json",
      "x-vercel-forwarded-for": index < 6 ? "127.0.0.21" : index < 12 ? "127.0.0.22" : "127.0.0.23",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(60000),
  });
  capture(r);
  if(!r.ok){let code;try{code=(await r.clone().json()).error;}catch{}lastHttp={status:r.status,code:typeof code==='string'&&/^[a-z_]{1,60}$/.test(code)?code:undefined};}
  return r;
}
let lastHttp=null;
let stage = "test mode guard",
  failed = false;
try {
  let r = await request("/api/checkout/config");
  assert.equal(r.status, 200);
  const config = await r.json();
  assert.equal(config.mode, "test");
  assert.equal(config.enabled, true);
  const plans = await db
    .from("catalog_plans")
    .select("id,destination_slug,retail_price_cents")
    .eq("destination_slug", "panama")
    .eq("kind", "fixed")
    .eq("is_published", true)
    .gt("retail_price_cents", 0)
    .order("retail_price_cents")
    .limit(30);
  check(plans.error);
  const bindings = await db
    .from("stripe_catalog_prices")
    .select("plan_id,price_id,amount_cents")
    .eq("livemode", false)
    .in(
      "plan_id",
      plans.data.map((p) => p.id),
    );
  check(bindings.error);
  const plan = plans.data.find((p) =>
    bindings.data.some(
      (b) => b.plan_id === p.id && b.amount_cents === p.retail_price_cents,
    ),
  );
  assert.ok(plan);
  for (const [index, definition] of currencies.entries()) {
    const currency = definition.code;
    stage = "create " + currency;
    r = await request("/api/regional/pricing?currency=" + currency);
    assert.equal(r.status, 200);
    const quote = await r.json(),
      amount = convertUsdMinor(plan.retail_price_cents, currency, quote.rate),
      id = randomUUID();
    const payload = {
      attemptId: id,
      locale: "es",
      currency,
      fxQuoteId: quote.id,
      expectedPaymentTotal: amount * 2,
      email,
      differentRecipient: false,
      marketingOptIn: false,
      holdPolicy: "leave-v1",
      lines: [
        { destination: plan.destination_slug, planId: plan.id, quantity: 2 },
      ],
      expectedTotal: plan.retail_price_cents * 2,
      compatible: true,
      terms: true,
      legalVersion,
    };
    fixtures.push(id);
    journal();
    r = await request("/api/checkout/session", payload, index);
    assert.equal(r.status, 200);
    const result = await r.json();
    assert.equal(result.orderId, id);
    assert.equal(result.paymentCurrency, currency);
    assert.equal(result.paymentTotal, amount * 2);
    assert.ok(result.clientSecret.startsWith("cs_test_"));
    const order = await db
      .from("checkout_orders")
      .select(
        "id,status,livemode,amount_total,payment_total,payment_currency,stripe_session_id",
      )
      .eq("id", id)
      .single();
    check(order.error);
    assert.equal(order.data.livemode, false);
    assert.equal(order.data.status, "pending");
    assert.equal(order.data.amount_total, plan.retail_price_cents * 2);
    assert.ok(order.data.stripe_session_id.startsWith("cs_test_"));
    const items = await db
      .from("checkout_order_items")
      .select(
        "stripe_price_id,unit_amount,quantity,payment_unit_amount,payment_stripe_price_id",
      )
      .eq("order_id", id);
    check(items.error);
    const session = await stripe.checkout.sessions.retrieve(
        order.data.stripe_session_id,
      ),
      lines = await stripe.checkout.sessions.listLineItems(session.id, {
        limit: 100,
      });
    assert.equal(session.livemode, false);
    assert.equal(session.currency, currency.toLowerCase());
    assert.equal(session.amount_total, amount * 2);
    verifyPaymentSnapshot(
      { ...order.data, items: items.data },
      session,
      lines.data.map((l) => ({
        priceId: l.price.id,
        quantity: l.quantity,
        amount: l.amount_total,
      })),
    );
    r = await request("/api/checkout/session", payload, index);
    assert.equal(r.status, 200);
    const retry = await r.json();
    assert.equal(
      retry.clientSecret,
      result.clientSecret,
      "retry must reuse one session",
    );
    r = await request("/api/checkout/status?order=" + id);
    assert.equal(r.status, 200);
    const receipt = await r.json();
    assert.equal(receipt.currency, currency);
    assert.equal(receipt.total, amount * 2);
    assert.equal(receipt.items[0].unit_amount, amount);
    const other = randomUUID();
    fixtures.push(other);
    journal();
    r = await request(
      "/api/checkout/session",
      { ...payload, attemptId: other, expectedPaymentTotal: amount * 2 + 1 },
      index,
    );
    assert.equal(r.status, 409);
    assert.equal((await r.json()).error, "price_changed");
    console.log(
      currency +
        ": test session, exact amount, retry and receipt verified; no payment confirmed.",
    );
  }
  console.log(
    "All18 selected currencies passed actual Stripe TEST session inspection. No charge, eSIM or email.",
  );
} catch {
  failed = true;
  if(lastHttp)console.error(JSON.stringify(lastHttp));
  console.error(
    "Currency checkout integration failed at " +
      stage +
      ". Private diagnostic IDs stay in ignored journal; no credentials printed.",
  );
} finally {
  stage = "cleanup";
  journal();
  const inventory=await stripe.checkout.sessions.list({created:{gte:startedAt-5},limit:100});
  if(inventory.has_more)throw Error('Bounded test cleanup requires review');
  const ownSessions=new Map(inventory.data.filter(session=>session.customer_email===email&&session.metadata?.mts_order_id&&fixtures.includes(session.metadata.mts_order_id)).map(session=>[session.metadata.mts_order_id,session.id]));
  for (const id of fixtures) {
    try {
      const r = await db
        .from("checkout_orders")
        .select("id,livemode,status,stripe_session_id,billing_email")
        .eq("id", id)
        .maybeSingle();
      check(r.error);
      if (!r.data) continue;
      assert.equal(r.data.livemode, false);
      assert.equal(r.data.billing_email, email);
      assert.notEqual(r.data.status, "paid");
      const sessionId=r.data.stripe_session_id??ownSessions.get(id);
      if (sessionId) {
        assert.ok(sessionId.startsWith("cs_test_"));
        const session = await stripe.checkout.sessions.retrieve(
          sessionId,
        );
        assert.equal(session.livemode, false);
        assert.notEqual(session.payment_status, "paid");
        // Retire only own unpaid TEST sessions. Removing the order metadata first keeps
        // their expiry events from creating dangling retries in the shared webhook.
        await stripe.checkout.sessions.update(session.id, {
          metadata: { mts_order_id: "" },
        });
        if (session.status === "open")
          await stripe.checkout.sessions.expire(session.id);
      }
      const units = await db
        .from("esim_fulfillments")
        .select("id", { count: "exact", head: true })
        .eq("order_id", id);
      check(units.error);
      assert.equal(units.count, 0);
      for (const table of [
        "checkout_legal_acceptances",
        "checkout_stripe_events",
        "checkout_order_items",
        "checkout_orders",
      ])
        check(
          (
            await db
              .from(table)
              .delete()
              .eq(table === "checkout_orders" ? "id" : "order_id", id)
          ).error,
        );
    } catch {
      failed = true;
      console.error(
        "A disposable test fixture needs cleanup review; journal retained.",
      );
    }
  }
  if (!failed) {
    fixtures.length = 0;
    stage = "complete";
    journal();
    console.log(
      "Disposable test orders removed and their unpaid sessions retired.",
    );
  }
  if (failed) process.exitCode = 1;
}
