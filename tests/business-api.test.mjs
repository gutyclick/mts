import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as policy from "../src/lib/portal/business.ts";
import { z } from "zod";
const uid = "11111111-1111-4111-8111-111111111111",
  company = "22222222-2222-4222-8222-222222222222";
function harness(admin = false, options = {}) {
  const calls = [];
  const client = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return options.result ?? { data: uid, error: null };
    },
  };
  const dependencies = {
    "next/server": {
      NextResponse: {
        json: (value, init) => new Response(JSON.stringify(value), init),
      },
    },
    zod: { z },
    "next/headers": {
      cookies: async () => ({ set: (...args) => calls.push({ cookie: args }) }),
    },
    "@/lib/portal/business": policy,
    "@/lib/payments/checkout-server": {
      checkoutDatabase: () => client,
      paymentOrigin: () => "https://www.mytripsim.com",
    },
    "@/lib/admin/server": {
      adminSession: async () =>
        options.adminSession ?? {
          user: { id: uid },
          admin: true,
          needsMfa: false,
        },
    },
    "@/lib/portal/server": {
      businessHeaders: { "Cache-Control": "private, no-store" },
      businessBody: async (request) => {
        if (
          !policy.businessOrigin(
            request.headers.get("origin"),
            request.headers.get("host"),
            true,
          )
        )
          throw Error("forbidden");
        return request.json();
      },
      businessIdentity: async () => ({
        client,
        user:
          options.user === null
            ? null
            : { id: uid, email: "verified@example.invalid" },
        needsMfa: !!options.mfa,
      }),
      businessWorkspace: async () => options.workspace ?? { company: null },
      businessSupport: () => {
        calls.push({ contactRead: true });
        return { email: "private@example.invalid", whatsapp: "+15550000000" };
      },
    },
  };
  const source = readFileSync(
    admin
      ? "src/app/api/admin/companies/route.ts"
      : "src/app/api/portal/route.ts",
    "utf8",
  );
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, {
    exports,
    require: (name) => {
      if (!(name in dependencies)) throw Error(name);
      return dependencies[name];
    },
    process: { env: { NODE_ENV: "production" } },
    Response,
    Headers,
    URL,
    TextEncoder,
  });
  return { exports, calls };
}
function request(body, origin = "https://portal.mytripsim.com") {
  const url = origin + "/api/portal";
  const req = new Request(url, {
    method: "POST",
    headers: {
      origin,
      host: new URL(origin).host,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  req.nextUrl = new URL(url);
  return req;
}
test("anonymous and MFA-incomplete company mutations cannot reach any RPC", async () => {
  for (const options of [{ user: null }, { mfa: true }]) {
    const h = harness(false, options);
    const r = await h.exports.POST(
      request({
        action: "invite",
        companyId: company,
        email: "x@example.invalid",
        role: "finance",
      }),
    );
    assert.equal(r.status, options.user === null ? 401 : 428);
    assert.equal(h.calls.length, 0);
  }
});
test("authenticated requests use the user client, strict payload and DB permission errors", async () => {
  const body = {
    action: "request",
    companyId: company,
    tripId: uid,
    attemptId: company,
    planId: "JP_10_30",
    quantity: 30,
    version: 1,
  };
  const h = harness();
  assert.equal(
    (await h.exports.POST(request({ ...body, actor: uid }))).status,
    400,
  );
  assert.equal(h.calls.length, 0);
  assert.equal((await h.exports.POST(request(body))).status, 200);
  assert.equal(h.calls[0].name, "b2b_submit_request");
  assert.equal(h.calls[0].args.p_company, company);
  assert.equal("p_actor" in h.calls[0].args, false);
  const denied = harness(false, {
    result: { data: null, error: { message: "role_required" } },
  });
  assert.equal((await denied.exports.POST(request(body))).status, 403);
});
test("private contacts are projected only after active membership", async () => {
  for (const options of [
    { user: null },
    { mfa: true },
    { workspace: { company: null } },
  ]) {
    const h = harness(false, options);
    const req = { nextUrl: new URL("https://portal.mytripsim.com/api/portal") };
    const r = await h.exports.GET(req);
    assert.equal(
      h.calls.some((call) => call.contactRead),
      false,
    );
    assert.doesNotMatch(await r.text(), /private@example/);
  }
  const h = harness(false, {
    workspace: {
      company: { id: company, name: "Private company", role: "owner" },
    },
  });
  await h.exports.GET({
    nextUrl: new URL("https://portal.mytripsim.com/api/portal"),
  });
  assert.equal(
    h.calls.some((call) => call.contactRead),
    true,
  );
});
test("administrator endpoints deny missing identity, role or MFA before service calls", async () => {
  for (const session of [
    { user: null },
    { user: { id: uid }, admin: false, needsMfa: false },
    { user: { id: uid }, admin: false, needsMfa: true },
  ]) {
    const h = harness(true, { adminSession: session });
    const r = await h.exports.GET();
    assert.ok([401, 403, 428].includes(r.status));
    assert.equal(h.calls.length, 0);
  }
});
test("administrator writes require same origin and bind the server-verified actor", async () => {
  const body = { action: "approve_application", id: company, note: "" };
  const h = harness(true);
  const bad = request(body);
  assert.equal((await h.exports.POST(bad)).status, 403);
  assert.equal(h.calls.length, 0);
  assert.equal(
    (
      await h.exports.POST(
        request({ ...body, actor: company }, "https://www.mytripsim.com"),
      )
    ).status,
    400,
  );
  assert.equal(
    (await h.exports.POST(request(body, "https://www.mytripsim.com"))).status,
    200,
  );
  assert.equal(h.calls[0].args.p_actor, uid);
  assert.equal(h.calls[0].name, "b2b_admin_action");
});
