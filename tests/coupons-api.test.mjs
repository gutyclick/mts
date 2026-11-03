import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import * as policy from "../src/lib/payments/coupons.ts";
import * as core from "../src/lib/payments/checkout-core.ts";
const origin = "https://www.mytripsim.com",
  actor = randomUUID(),
  id = randomUUID();
function harness(kind, options = {}) {
  const calls = [];
  const result = {
    id,
    code: "VIAJE5",
    currency: "USD",
    paymentTotal: 950,
    discountTotal: 50,
    discountUsdCents: 50,
    expiresAt: new Date(Date.now() + 600000).toISOString(),
  };
  const dependencies = {
    "next/server": {
      NextResponse: {
        json: (body, init) => new Response(JSON.stringify(body), init),
      },
    },
    zod: { z },
    "@/lib/admin/server": {
      adminSession: async () =>
        options.session ?? {
          user: { id: actor },
          needsMfa: false,
          admin: true,
        },
    },
    "@/lib/supabase/auth-server": {
      authClient: async () => ({
        auth: {
          getUser: async () => ({
            data: { user: options.user ?? null },
            error: options.authError ?? null,
          }),
        },
      }),
    },
    "@/lib/payments/checkout-server": {
      paymentOrigin: () => origin,
      paymentHeaders: { "Cache-Control": "private, no-store" },
      checkoutConfigured: () => true,
      checkoutDatabase: () => ({
        rpc: async (name, args) => {
          calls.push({ name, args });
          return options.rpcError
            ? { error: { message: options.rpcError } }
            : {
                data:
                  options.rpcByName?.[name] ??
                  options.rpcData ??
                  (kind === "coupon" ? result : { ok: true }),
              };
        },
      }),
    },
    "@/lib/payments/checkout-core": core,
    "@/lib/payments/coupons": policy,
    "@/lib/payments/promotion-costs": {
      refreshPromotionCosts: () => {
        throw Error("Unexpected supplier access");
      },
      promotionCostSchema: z.object({}),
    },
  };
  const source = readFileSync(
    kind === "coupon"
      ? "src/app/api/checkout/coupon/route.ts"
      : "src/app/api/admin/coupons/route.ts",
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require: (name) => {
      assert.ok(dependencies[name], name);
      return dependencies[name];
    },
    Response,
    TextEncoder,
    process: {
      env: { CHECKOUT_REQUEST_SECRET: "secret-for-tests-only-not-a-real-key" },
    },
    console,
  });
  return { api: exports, calls, result };
}
function request(body, source = origin) {
  const req = new Request(origin + "/api/checkout/coupon", {
    method: "POST",
    headers: {
      origin: source,
      "Content-Type": "application/json",
      "x-vercel-forwarded-for": "192.0.2.1",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
  req.cookies = { get: () => ({ value: "b".repeat(64) }) };
  return req;
}
const quoteBody = {
  code: "VIAJE5",
  email: "guest@example.invalid",
  lines: [{ planId: "JP_1_7", destination: "japan", quantity: 1 }],
  currency: "USD",
  fxQuoteId: null,
};
test("coupon admin requires session, membership, actual MFA and same-origin writes before any RPC", async () => {
  for (const [session, status] of [
    [{ user: null, admin: false, needsMfa: false }, 401],
    [{ user: { id: actor }, admin: false, needsMfa: false }, 403],
    [{ user: { id: actor }, admin: false, needsMfa: true }, 428],
  ]) {
    const h = harness("admin", { session });
    assert.equal((await h.api.GET()).status, status);
    assert.equal((await h.api.POST(request({}))).status, status);
    assert.equal(h.calls.length, 0);
  }
  const h = harness("admin");
  assert.equal(
    (await h.api.POST(request({}, "https://evil.example"))).status,
    403,
  );
  assert.equal(h.calls.length, 0);
});
test("admin mutations bind the session actor, validate payload and preserve idempotency UUID", async () => {
  const h = harness("admin"),
    key = randomUUID();
  const body = { action: "archive", request: key, value: { id } };
  for (let n = 0; n < 2; n++)
    assert.equal((await h.api.POST(request(body))).status, 200);
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[0].args.p_actor, actor);
  assert.equal(h.calls[1].args.p_request, key);
  assert.equal(
    (await h.api.POST(request({ ...body, p_actor: randomUUID() }))).status,
    400,
  );
  assert.equal((await h.api.POST(request("{bad"))).status, 400);
  assert.equal(h.calls.length, 2);
});
test("coupon quotes hash billing identity and IP without returning or storing raw private values", async () => {
  const user = {
    id: actor,
    email: "verified@example.invalid",
    email_confirmed_at: new Date().toISOString(),
  };
  const h = harness("coupon", { user });
  const response = await h.api.POST(request(quoteBody));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.quote.id, id);
  assert.equal(h.calls[0].args.p_user, actor);
  assert.equal(
    h.calls[0].args.p_identity,
    core.privateHash(user.email, "secret-for-tests-only-not-a-real-key"),
  );
  assert.match(h.calls[0].args.p_rate_key, /^[a-f0-9]{64}$/);
  assert.equal(
    JSON.stringify(h.calls).includes("verified@example.invalid"),
    false,
  );
  assert.equal(JSON.stringify(data).includes("wholesale"), false);
});
test("guest validation and auth failures cannot silently bypass identity or create quotes", async () => {
  for (const body of [
    { ...quoteBody, email: "bad" },
    { ...quoteBody, discount: 999 },
    { ...quoteBody, lines: [] },
  ]) {
    const h = harness("coupon");
    assert.equal((await h.api.POST(request(body))).status, 400);
    assert.equal(h.calls.length, 0);
  }
  const broken = harness("coupon", { authError: { name: "AuthApiError" } });
  assert.equal((await broken.api.POST(request(quoteBody))).status, 503);
  assert.equal(broken.calls.length, 0);
  const forged = harness("coupon");
  assert.equal(
    (await forged.api.POST(request(quoteBody, "https://evil.example"))).status,
    403,
  );
  assert.equal(forged.calls.length, 0);
});
test("supplier margin rejections expose no costs and never turn into a discount", async () => {
  const h = harness("coupon", { rpcData: { error: "coupon_margin" } });
  const r = await h.api.POST(request(quoteBody));
  assert.equal(r.status, 409);
  assert.deepEqual(await r.json(), { error: "coupon_margin" });
  assert.equal(h.calls.length, 1);
});

test("code-specific condition requests preserve guards and expose only the safe DTO", async () => {
  const details = {
    code: "VIAJE5",
    minimumUsdCents: 1500,
    startsAt: null,
    endsAt: null,
    eligiblePlans: "published_fixed",
    eligibility: "not_evaluated",
    wholesaleUnitUnits: 12345,
  };
  const h = harness("coupon", { rpcData: details });
  const response = await h.api.POST(
    request({ ...quoteBody, action: "details" }),
  );
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.details.minimumUsdCents, 1500);
  assert.equal(body.details.eligibility, "not_evaluated");
  assert.equal(JSON.stringify(body).includes("wholesale"), false);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].name, "coupon_lookup_details");
  assert.equal(h.calls[0].args.p_user, null);
  assert.match(h.calls[0].args.p_rate_key, /^[a-f0-9]{64}$/);
  const unverified = harness("coupon", {
    user: { id: actor, email: "unverified@example.invalid" },
  });
  assert.equal(
    (await unverified.api.POST(request({ ...quoteBody, action: "details" })))
      .status,
    403,
  );
  assert.equal(unverified.calls.length, 0);
  const blocked = harness("coupon", { rpcData: { error: "rate_limit" } });
  assert.equal(
    (await blocked.api.POST(request({ ...quoteBody, action: "details" })))
      .status,
    409,
  );
});

test("admin reporting requires both private reports and never substitutes unavailable insights with zero", async () => {
  const insights = {
    [id]: {
      paidOrders: 1,
      salesUsdCents: 800,
      discountUsdCents: 200,
      estimatedOrders: 1,
      estimatedContributionUsdCents: 300,
      refundExcludedOrders: 1,
      refundExcludedSalesUsdCents: 800,
    },
  };
  const snapshot = { coupons: [], summary: { active: 0 } };
  const h = harness("admin", {
    rpcByName: {
      coupon_admin_snapshot: snapshot,
      coupon_admin_insights: insights,
    },
  });
  const response = await h.api.GET();
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).insights, insights);
  assert.equal(h.calls.length, 2);
  assert.equal(h.calls[1].args.p_actor, actor);
  const missing = harness("admin", {
    rpcByName: {
      coupon_admin_snapshot: snapshot,
      coupon_admin_insights: false,
    },
    rpcData: null,
  });
  // No valid snapshot data yields unavailability, never a fabricated metric.
  assert.equal((await missing.api.GET()).status, 503);
});
