import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as zod from "zod";
import { randomBytes } from "node:crypto";
import * as core from "../src/lib/payments/checkout-core.ts";
import * as policy from "../src/lib/payments/yappy-policy.ts";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const user = {
  id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  email: "owner@example.invalid",
  email_confirmed_at: "2026-11-07T00:00:00Z",
};
const env = {
  YAPPY_RETAIL_LIVE_MERCHANT_ID: "fixture",
  YAPPY_RETAIL_LIVE_SECRET: Buffer.from("fixture.key").toString("base64"),
  YAPPY_RETAIL_ENABLED: "true",
  YAPPY_RETAIL_PERSISTENCE_READY: "true",
  YAPPY_RETAIL_FEES_CONFIRMED: "true",
  YAPPY_RETAIL_FEE_BPS: "100",
  YAPPY_RETAIL_FIXED_CENTS: "0",
  CHECKOUT_REQUEST_SECRET: "a".repeat(64),
};
const body = {
  attemptId: id,
  locale: "es",
  currency: "USD",
  fxQuoteId: null,
  email: "owner@example.invalid",
  differentRecipient: false,
  marketingOptIn: false,
  lines: [{ destination: "panama", planId: "PA_1_7", quantity: 1 }],
  expectedTotal: 400,
  expectedPaymentTotal: 400,
  compatible: true,
  terms: true,
  legalVersion: "2026-10-27-v1",
};
// Read the live legal literal from the shared schema rather than duplicating its date.
const legalSource = readFileSync("src/lib/legal-version.ts", "utf8");
body.legalVersion = legalSource.match(/20\d\d-\d\d-\d\d-v\d+/)[0];
function fixture({
  pending = false,
  uncertain = false,
  guest = false,
  enabled = true,
} = {}) {
  const calls = [];
  let purchases = 0,
    authCalls = 0;
  const order = {
    id,
    status: "pending",
    billing_email: "owner@example.invalid",
    livemode: true,
    payment_total: null,
    payment_currency: null,
    stripe_session_id: null,
  };
  const db = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      if (name === "create_checkout_v3") return { data: order };
      if (name === "prepare_checkout_payment")
        return {
          data: { ...order, payment_total: 400, payment_currency: "USD" },
        };
      return { data: true };
    },
    from: (table) => {
      const response =
        table === "catalog_plans"
          ? {
              data: [
                {
                  id: "PA_1_7",
                  allowance: "1GB",
                  days: 7,
                  coverage_code: "PA",
                },
              ],
            }
          : table === "simcoins_private_costs"
            ? {
                data: [
                  {
                    plan_id: "PA_1_7",
                    wholesale_unit_units: 10000,
                    observed_at: new Date().toISOString(),
                  },
                ],
              }
            : { data: null };
      const chain = {
        select() {
          return chain;
        },
        eq() {
          return chain;
        },
        in() {
          return chain;
        },
        maybeSingle: async () => ({
          data: pending ? { state: "pending" } : null,
        }),
        upsert: async () => ({ data: null }),
        then: (a, b) => Promise.resolve(response).then(a, b),
      };
      return chain;
    },
  };
  const dependencies = {
    "server-only": {},
    "node:crypto": { randomBytes },
    zod: zod,
    "../supabase/auth-server": {
      authClient: async () => ({
        auth: {
          getUser: async () => {
            authCalls++;
            return {
              data: { user: guest ? null : user },
              error: guest ? { name: "AuthSessionMissingError" } : null,
            };
          },
        },
      }),
    },
    "../integrations/yappy": {
      createYappyOrder: async () => {
        purchases++;
        if (uncertain) throw Error("timeout");
        return {
          transactionId: "fixture-tx",
          token: "fixture-token",
          documentName: "fixture-doc",
        };
      },
    },
    "./checkout-server": {
      checkoutDatabase: () => db,
      paymentMode: () => "live",
      paymentOrigin: () => "https://www.mytripsim.com",
    },
    "./checkout-core": core,
    "./yappy-policy": policy,
    "./promotion-costs": {
      promotionCostSchema: zod.z.object({
        plan_id: zod.z.string(),
        wholesale_unit_units: zod.z.number(),
        observed_at: zod.z.string(),
      }),
      refreshPromotionCosts: async (_plans, costs) => costs,
    },
    "../simcoins/checkout-server": {
      reserveSimcoinsCheckout: async () => {},
      simcoinsCheckoutEnabled: () => true,
    },
  };
  const exports = {};
  const js = ts.transpileModule(
    readFileSync("src/lib/payments/yappy-retail.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(js, {
    exports,
    require: (name) => {
      if (!(name in dependencies)) throw Error(name);
      return dependencies[name];
    },
    process: { env: { ...env, YAPPY_RETAIL_ENABLED: String(enabled) } },
    Date,
    Buffer,
    URL,
    console,
  });
  const request = (
    value = body,
    { origin = "https://www.mytripsim.com", cookie = "a".repeat(64) } = {},
  ) => ({
    headers: new Headers({
      origin: origin,
      "content-type": "application/json",
    }),
    cookies: { get: () => (cookie ? { value: cookie } : undefined) },
    text: async () => JSON.stringify(value),
  });
  return {
    begin: exports.beginRetailYappy,
    request,
    calls,
    get purchases() {
      return purchases;
    },
    get authCalls() {
      return authCalls;
    },
  };
}
test("retail request rejects wrong origin, cookies, currency and terms before authentication or provider calls", async () => {
  const f = fixture();
  await assert.rejects(
    f.begin(f.request(body, { origin: "https://evil.invalid" })),
    (e) => e.status === 403,
  );
  await assert.rejects(
    f.begin(f.request(body, { cookie: "" })),
    (e) => e.code === "cookies_required",
  );
  await assert.rejects(
    f.begin(
      f.request({
        ...body,
        currency: "EUR",
        fxQuoteId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      }),
    ),
    (e) => e.code === "yappy_usd_required",
  );
  await assert.rejects(
    f.begin(f.request({ ...body, terms: false })),
    (e) => e.code === "invalid_request",
  );
  assert.equal(f.authCalls, 0);
  assert.equal(f.purchases, 0);
  const disabled = fixture({ enabled: false });
  await assert.rejects(
    disabled.begin(disabled.request()),
    (e) => e.code === "yappy_unavailable",
  );
});
test("confirmed request prepares existing order and binds a single mocked provider transaction; no browser success settles payment", async () => {
  const f = fixture();
  const result = await f.begin(f.request());
  assert.equal(result.orderId, id);
  assert.equal(result.transactionId, "fixture-tx");
  assert.equal(f.purchases, 1);
  const names = f.calls.map((c) => c.name);
  assert.deepEqual(names, [
    "create_checkout_v3",
    "prepare_checkout_payment",
    "retail_yappy_claim",
    "retail_yappy_bind",
  ]);
  assert.equal(
    f.calls.find((c) => c.name === "retail_yappy_claim").args.p_amount,
    400,
  );
  assert.ok(!names.includes("retail_yappy_settle"));
});
test("existing or uncertain transaction is not retried with a new provider order; guests cannot use account coupons", async () => {
  const f = fixture({ pending: true });
  await assert.rejects(
    f.begin(f.request()),
    (e) => e.code === "yappy_payment_pending",
  );
  assert.equal(f.purchases, 0);
  const uncertain = fixture({ uncertain: true });
  await assert.rejects(
    uncertain.begin(uncertain.request()),
    (e) => e.code === "yappy_payment_pending",
  );
  assert.equal(uncertain.purchases, 1);
  assert.ok(uncertain.calls.some((c) => c.name === "retail_yappy_review"));
  const guest = fixture({ guest: true });
  await assert.rejects(
    guest.begin(
      guest.request({
        ...body,
        couponQuoteId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
      }),
    ),
    (e) => e.code === "account_required",
  );
  assert.equal(guest.purchases, 0);
});
