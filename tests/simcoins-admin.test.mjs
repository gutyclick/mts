import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";

const source = readFileSync(
  new URL("../src/app/api/admin/simcoins/route.ts", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const actor = "11111111-1111-4111-8111-111111111111",
  user = "22222222-2222-4222-8222-222222222222",
  requestId = "33333333-3333-4333-8333-333333333333";
function harness({
  session = { user: { id: actor }, admin: true, needsMfa: false },
  enabled = true,
} = {}) {
  const calls = [],
    exports = {};
  const modules = {
    "next/server": {
      NextResponse: {
        json: (body, options) => ({
          body,
          status: options.status,
          headers: options.headers,
        }),
      },
    },
    zod: { z },
    "@/lib/admin/server": { adminSession: async () => session },
    "@/lib/payments/checkout-server": {
      paymentHeaders: { "cache-control": "no-store" },
      paymentOrigin: () => "https://www.mytripsim.com",
      checkoutDatabase: () => ({
        rpc: async (name, args) => {
          calls.push({ name, args });
          return { data: { settings: {} }, error: null };
        },
      }),
    },
    "@/lib/simcoins/config": {
      simcoinsFlags: () => ({
        adminEnabled: enabled,
        persistenceReady: enabled,
      }),
    },
  };
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      assert.ok(modules[name], name);
      return modules[name];
    },
    TextEncoder,
  });
  return { ...exports, calls };
}
function request(body, origin = "https://www.mytripsim.com") {
  return {
    headers: new Headers({ origin, "content-type": "application/json" }),
    text: async () => JSON.stringify(body),
  };
}
const adjustment = {
  action: "adjust",
  user,
  coins: 100,
  reason: "Documented support adjustment",
  request: requestId,
};
test("admin mutations require same origin, membership and actual MFA before RPC", async () => {
  const normal = harness();
  assert.equal(
    (await normal.POST(request(adjustment, "https://attacker.invalid"))).status,
    403,
  );
  assert.equal(normal.calls.length, 0);
  for (const [session, status] of [
    [{ user: null, admin: false, needsMfa: false }, 401],
    [{ user: { id: actor }, admin: false, needsMfa: false }, 403],
    [{ user: { id: actor }, admin: false, needsMfa: true }, 428],
  ]) {
    const api = harness({ session });
    assert.equal((await api.POST(request(adjustment))).status, status);
    assert.equal(api.calls.length, 0);
  }
});
test("disabled admin reads and writes never open the financial database", async () => {
  const api = harness({ enabled: false });
  assert.equal((await api.GET()).body.configured, false);
  assert.equal((await api.POST(request(adjustment))).body.error, "disabled");
  assert.equal(api.calls.length, 0);
});
test("adjustment actor comes from session and retries preserve the business request UUID", async () => {
  const api = harness();
  for (let i = 0; i < 2; i++)
    assert.equal((await api.POST(request(adjustment))).status, 200);
  assert.equal(api.calls.length, 2);
  for (const call of api.calls) {
    assert.equal(call.name, "simcoins_admin_adjust");
    assert.equal(call.args.p_actor, actor);
    assert.equal(call.args.p_user, user);
    assert.equal(call.args.p_request, requestId);
  }
  assert.equal(
    (await api.POST(request({ ...adjustment, actor: user }))).status,
    400,
  );
});
test("invalid adjustments, excessive bodies and unknown settings fail before RPC", async () => {
  const api = harness();
  for (const body of [
    { ...adjustment, coins: 0 },
    { ...adjustment, coins: 0.5 },
    { ...adjustment, reason: "short" },
    { ...adjustment, request: "invalid" },
    {
      action: "settings",
      value: { unexpected: true },
      reason: adjustment.reason,
      request: requestId,
    },
  ])
    assert.equal((await api.POST(request(body))).status, 400);
  const large = request({ ...adjustment, reason: "a".repeat(17000) });
  assert.equal((await api.POST(large)).status, 413);
  assert.equal(api.calls.length, 0);
});
test("financial configuration enforces all budget floors and redemption ceilings", async () => {
  const api = harness();
  const base = {
    action: "settings",
    reason: adjustment.reason,
    request: requestId,
  };
  for (const value of [
    { stripe_bps: 439 },
    { stripe_fx_bps: 539 },
    { fixed_fee_units: 2999 },
    { affiliate_bps: 799 },
    { min_contribution_bps: 1999 },
    { max_redeem_bps: 501 },
    { max_promotion_bps: 501 },
    {},
  ])
    assert.equal((await api.POST(request({ ...base, value }))).status, 400);
  assert.equal(api.calls.length, 0);
  assert.equal(
    (
      await api.POST(
        request({
          ...base,
          value: {
            stripe_bps: 440,
            stripe_fx_bps: 540,
            fixed_fee_units: 3000,
            affiliate_bps: 800,
            min_contribution_bps: 2000,
            max_redeem_bps: 500,
          },
        }),
      )
    ).status,
    200,
  );
  assert.equal(api.calls[0].name, "simcoins_admin_configure");
});
test("welcome and first-purchase tier markers cannot be rewritten", async () => {
  const api = harness(),
    base = { action: "level", reason: adjustment.reason, request: requestId };
  for (const value of [
    { id: "traveler", name: "Traveler", threshold_cents: 0, rate_bps: 300 },
    { id: "explorer", name: "Explorer", threshold_cents: 0, rate_bps: 300 },
  ])
    assert.equal((await api.POST(request({ ...base, value }))).status, 400);
  assert.equal(api.calls.length, 0);
});
