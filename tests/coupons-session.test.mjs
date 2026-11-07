import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import * as core from "../src/lib/payments/checkout-core.ts";
import { legalVersion } from "../src/lib/legal-version.ts";
import { couponFailure } from "../src/lib/payments/coupons.ts";
import { catalogPreviewEnabled } from "../src/lib/catalog-preview.ts";

function harness(user = null) {
  const calls = [];
  const deps = {
    "next/server": {
      NextResponse: {
        json: (body, init) => new Response(JSON.stringify(body), init),
      },
    },
    zod: { z },
    "@/lib/catalog-preview": { catalogPreviewEnabled },
    "@/lib/supabase/auth-server": {
      authClient: async () => ({
        auth: { getUser: async () => ({ data: { user }, error: null }) },
      }),
    },
    "@/lib/payments/checkout-core": core,
    "@/lib/payments/coupons": { couponFailure },
    "@/lib/payments/hold-server": {},
    "@/lib/analytics/server": {},
    "@/lib/payments/hold-policy": {},
    "@/lib/simcoins/checkout-server": {},
    "@/lib/payments/checkout-server": {
      checkoutConfigured: () => true,
      paymentOrigin: () => "https://www.mytripsim.com",
      paymentMode: () => "live",
      paymentHeaders: {},
      checkoutDatabase: () => ({
        rpc: async (name, args) => {
          calls.push({ name, args });
          return { error: { message: "checkout_rate_limit" } };
        },
      }),
    },
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync("src/app/api/checkout/session/route.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      require: (n) => {
        assert.ok(deps[n], n);
        return deps[n];
      },
      Response,
      process: { env: { CHECKOUT_REQUEST_SECRET: "fixture" } },
      console,
    },
  );
  return { api: exports, calls };
}
function request(coupon = true) {
  const body = {
    attemptId: randomUUID(),
    locale: "es",
    email: "spoof@example.invalid",
    lines: [{ destination: "japan", planId: "JP_1_7", quantity: 1 }],
    expectedTotal: 400,
    compatible: true,
    terms: true,
    legalVersion,
    ...(coupon ? { couponQuoteId: randomUUID() } : {}),
  };
  const req = new Request("https://www.mytripsim.com/api/checkout/session", {
    method: "POST",
    headers: {
      origin: "https://www.mytripsim.com",
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  req.cookies = { get: () => ({ value: "b".repeat(64) }) };
  return req;
}
test("old guest coupon quote IDs are denied before orders, reservations or payment sessions", async () => {
  const h = harness();
  const r = await h.api.POST(request());
  assert.equal(r.status, 403);
  assert.deepEqual(await r.json(), { error: "account_required" });
  assert.equal(h.calls.length, 0);
});
test("ordinary guests and verified coupon accounts still reach order preparation with server identity", async () => {
  for (const user of [
    null,
    {
      id: randomUUID(),
      email: "verified@example.invalid",
      email_confirmed_at: new Date().toISOString(),
    },
  ]) {
    const h = harness(user);
    const r = await h.api.POST(request(!!user));
    assert.equal(r.status, 429);
    assert.equal(h.calls[0].name, "create_checkout_v3");
    assert.equal(h.calls[0].args.p_user_id, user?.id ?? null);
    assert.equal(
      h.calls[0].args.p_billing_email,
      user?.email ?? "spoof@example.invalid",
    );
  }
});
