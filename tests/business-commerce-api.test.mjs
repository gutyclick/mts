import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import * as validation from "../src/lib/portal/commerce-validation.ts";
import { businessOrigin } from "../src/lib/portal/business.ts";

const actor = "11111111-1111-4111-8111-111111111111";
const company = "22222222-2222-4222-8222-222222222222";
const foreign = "33333333-3333-4333-8333-333333333333";
const orderId = "44444444-4444-4444-8444-444444444444";
const trip = "55555555-5555-4555-8555-555555555555";
const order = {
  id: orderId,
  company_id: company,
  trip_id: trip,
  plan_id: "JP_10_30",
  state: "awaiting_payment",
  paid_at: null,
  quote_expires_at: "2099-01-01T00:00:00Z",
  total_cents: 3000,
};
const methods = { stripe: true, transfer: true, yappy: true };
function compile(path, dependencies) {
  const exports = {};
  const source = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  vm.runInNewContext(source, {
    exports,
    require: (name) => {
      if (!(name in dependencies))
        throw Error(`Unexpected dependency: ${name}`);
      return dependencies[name];
    },
    process: { env: { NODE_ENV: "production" } },
    Response,
    Headers,
    URL,
    TextEncoder,
    Buffer,
  });
  return exports;
}
function request(body, origin = "https://portal.mytripsim.com") {
  const req = new Request(
    `${origin}/api/portal/commerce?tripId=${trip}&orderId=${orderId}`,
    {
      method: body ? "POST" : "GET",
      headers: {
        origin,
        host: new URL(origin).host,
        "content-type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    },
  );
  req.nextUrl = new URL(req.url);
  return req;
}
function harness(kind = "customer", options = {}) {
  const calls = [];
  const readiness = {
    stripe: true,
    yappy: false,
    issuance: false,
    ...options.readiness,
  };
  const client = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return options.rpcError
        ? { error: { message: "company_required" } }
        : {
            data:
              name === "b2b_commerce_workspace"
                ? {
                    order,
                    units: [],
                    payment_methods: methods,
                    bank_instructions: "Private bank instructions",
                  }
                : actor,
            error: null,
          };
    },
  };
  const service = {
    ...client,
    from: () => {
      calls.push({ table: true });
      throw Error("Unexpected table access");
    },
  };
  const commerce = {
    commerceReadiness: () => readiness,
    commercialOrder: async () => {
      calls.push({ orderRead: true });
      return { ...order, ...options.order };
    },
    refreshBusinessCost: async () => calls.push({ costRefresh: true }),
  };
  const dependencies = {
    "next/server": {
      NextResponse: {
        json: (body, init) => new Response(JSON.stringify(body), init),
      },
      after: () => {
        throw Error("Unexpected worker dispatch");
      },
    },
    zod: { z },
    "@/lib/admin/server": {
      adminSession: async () =>
        options.adminSession ?? {
          user: { id: actor },
          admin: true,
          needsMfa: false,
        },
    },
    "@/lib/portal/commerce-validation": validation,
    "@/lib/portal/commerce-server": commerce,
    "@/lib/payments/checkout-server": {
      checkoutDatabase: () => service,
      paymentOrigin: () => "https://www.mytripsim.com",
      paymentMode: () => "live",
    },
    "@/lib/portal/server": {
      businessHeaders: { "Cache-Control": "private, no-store" },
      businessBody: async (req) => {
        if (
          !businessOrigin(
            req.headers.get("origin"),
            req.headers.get("host"),
            true,
          )
        )
          throw Error("forbidden");
        return req.json();
      },
      businessIdentity: async () => ({
        client,
        user: options.anonymous ? null : { id: actor },
        needsMfa: !!options.mfa,
      }),
      businessWorkspace: async () => ({
        restricted: !!options.restricted,
        companies: [
          { id: options.company ?? company, role: options.role ?? "owner" },
        ],
      }),
    },
    "@/lib/portal/commerce-payments": {
      beginBusinessPayment: async (...args) => {
        calls.push({ payment: args });
        return { url: "https://checkout.stripe.com/mock" };
      },
      recordBusinessPayment: async (...args) => calls.push({ record: args }),
    },
    "@/lib/portal/fulfillment-server": {},
    "@/lib/portal/notification-server": {},
    qrcode: {},
    "@/lib/portal/zip": {},
  };
  const paths = {
    customer: "src/app/api/portal/commerce/route.ts",
    admin: "src/app/api/admin/business-commerce/route.ts",
    download: "src/app/api/portal/commerce/download/route.ts",
  };
  return { api: compile(paths[kind], dependencies), calls };
}
const tariff = {
  action: "save_tariff",
  planId: "JP_10_30",
  companyId: null,
  unitCents: 1000,
  active: true,
};

test("commerce admin denies anonymous, non-admin and incomplete MFA before service calls", async () => {
  for (const [session, status] of [
    [{ user: null }, 401],
    [{ user: { id: actor }, admin: false }, 403],
    [{ user: { id: actor }, admin: true, needsMfa: true }, 428],
  ]) {
    const h = harness("admin", { adminSession: session });
    assert.equal((await h.api.GET(request())).status, status);
    assert.equal(
      (await h.api.POST(request(tariff, "https://www.mytripsim.com"))).status,
      status,
    );
    assert.equal(h.calls.length, 0);
  }
});
test("customer commerce denies anonymous and incomplete MFA before reading orders", async () => {
  for (const [options, status] of [
    [{ anonymous: true }, 401],
    [{ mfa: true }, 428],
  ]) {
    const h = harness("customer", options);
    assert.equal((await h.api.GET(request())).status, status);
    assert.equal(
      (await h.api.POST(request({ action: "stripe", orderId }))).status,
      status,
    );
    assert.equal(h.calls.length, 0);
  }
});
test("coordinators, restricted accounts and foreign tenants cannot pay", async () => {
  for (const options of [
    { role: "coordinator" },
    { restricted: true },
    { company: foreign },
  ]) {
    const h = harness("customer", options);
    assert.equal(
      (await h.api.POST(request({ action: "stripe", orderId }))).status,
      403,
    );
    assert.equal(
      h.calls.some((c) => c.payment || c.record),
      false,
    );
  }
});
test("tenant RPC denial blocks both payment and private commerce projection", async () => {
  const h = harness("customer", { rpcError: true });
  assert.equal(
    (await h.api.POST(request({ action: "stripe", orderId }))).status,
    403,
  );
  const response = await h.api.GET(request());
  assert.equal(response.status, 403);
  assert.doesNotMatch(await response.text(), /Private bank/);
  assert.equal(
    h.calls.some((c) => c.payment || c.record),
    false,
  );
});
test("finance cannot download and a foreign owner cannot download", async () => {
  for (const options of [{ role: "finance" }, { company: foreign }]) {
    const h = harness("download", options);
    assert.equal((await h.api.GET(request())).status, 403);
    assert.equal(
      h.calls.some((c) => c.table),
      false,
    );
  }
});
test("strict payment payload rejects client price, tenant, actor and payment-state tampering", async () => {
  for (const extra of [
    { unitCents: 1 },
    { totalCents: 1 },
    { companyId: foreign },
    { actor },
    { paid: true },
  ]) {
    const h = harness();
    assert.equal(
      (await h.api.POST(request({ action: "stripe", orderId, ...extra })))
        .status,
      400,
    );
    assert.equal(h.calls.length, 0);
  }
});
test("authorized finance payment forwards only server order, actor and selected method", async () => {
  const h = harness("customer", { role: "finance" });
  assert.equal(
    (await h.api.POST(request({ action: "stripe", orderId }))).status,
    200,
  );
  const call = h.calls.find((c) => c.payment);
  assert.deepEqual(Array.from(call.payment), [orderId, actor, "stripe", "es"]);
});
test("admin origin and strict actor binding protect tariff writes", async () => {
  const h = harness("admin");
  assert.equal(
    (await h.api.POST(request(tariff, "https://attacker.invalid"))).status,
    403,
  );
  assert.equal(
    (
      await h.api.POST(
        request({ ...tariff, actor: foreign }, "https://www.mytripsim.com"),
      )
    ).status,
    400,
  );
  assert.equal(h.calls.length, 0);
  assert.equal(
    (await h.api.POST(request(tariff, "https://www.mytripsim.com"))).status,
    200,
  );
  assert.equal(h.calls[0].name, "b2b_commerce_admin");
  assert.equal(h.calls[0].args.p_actor, actor);
  assert.equal(h.calls[0].args.p_value.unit_cents, 1000);
});
test("configured database methods stay hidden when server readiness disables them", async () => {
  const h = harness("customer", { readiness: { stripe: false, yappy: false } });
  const response = await h.api.GET(request());
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).methods, {
    stripe: false,
    transfer: true,
    yappy: false,
  });
});
test("disabled Yappy fails in the real payment service before cost refresh, ledger or network", async () => {
  let touched = false;
  const api = compile("src/lib/portal/commerce-payments.ts", {
    "server-only": {},
    "node:crypto": {
      randomUUID: () => {
        throw Error("Unexpected UUID allocation");
      },
    },
    zod: { z },
    "../payments/checkout-server": {
      checkoutDatabase: () => {
        touched = true;
        throw Error("Unexpected DB");
      },
      checkoutStripe: () => {
        touched = true;
        throw Error("Unexpected Stripe");
      },
      paymentMode: () => "live",
    },
    "../integrations/yappy": {
      yappyConfig: () => {
        touched = true;
        throw Error("Unexpected Yappy");
      },
      createYappyOrder: () => {
        touched = true;
        throw Error("Unexpected network");
      },
    },
    "./commerce-server": {
      commercialOrder: async () => order,
      commercialSettings: async () => ({ yappy_enabled: true }),
      commerceReadiness: () => ({ yappy: false }),
      refreshBusinessCost: async () => {
        touched = true;
      },
    },
    "./payment-snapshot": {},
  });
  await assert.rejects(
    api.beginBusinessPayment(orderId, actor, "yappy", "es"),
    /not_configured/,
  );
  assert.equal(touched, false);
});

test("download denies anonymous and incomplete MFA before service access", async () => {
  for (const [options, status] of [
    [{ anonymous: true }, 401],
    [{ mfa: true }, 403],
  ]) {
    const h = harness("download", options);
    assert.equal((await h.api.GET(request())).status, status);
    assert.equal(h.calls.length, 0);
  }
});

test("admin cannot enable an unconfigured payment method or issuance", async () => {
  const settings = {
    bank_enabled: false,
    bank_instructions: "",
    stripe_enabled: false,
    yappy_enabled: false,
    yappy_fee_bps: null,
    yappy_fixed_cents: 0,
    other_reserve_cents: 0,
    issuance_enabled: false,
  };
  for (const change of [
    { stripe_enabled: true },
    { yappy_enabled: true, yappy_fee_bps: 100 },
    { issuance_enabled: true },
  ]) {
    const h = harness("admin", {
      readiness: { stripe: false, yappy: false, issuance: false },
    });
    const response = await h.api.POST(
      request(
        { action: "save_settings", value: { ...settings, ...change } },
        "https://www.mytripsim.com",
      ),
    );
    assert.equal(response.status, 409);
    assert.equal((await response.json()).error, "not_configured");
    assert.equal(h.calls.length, 0);
  }
});
