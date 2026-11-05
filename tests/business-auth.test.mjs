import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { z } from "zod";
import { createHmac } from "node:crypto";
import { businessOrigin, workspaceSchema } from "../src/lib/portal/business.ts";
function load(file, dependencies, env = {}) {
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require: (name) => {
        if (!(name in dependencies)) throw Error(name);
        return dependencies[name];
      },
      process: { env: { NODE_ENV: "production", ...env } },
      Response,
      Headers,
      URL,
      TextEncoder,
      TextDecoder,
      Uint8Array,
    },
  );
  return exports;
}
function auth(options = {}) {
  const calls = [];
  const user = {
    id: "11111111-1111-4111-8111-111111111111",
    email_confirmed_at: "2026-11-05",
    factors: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        status: "verified",
        factor_type: "totp",
      },
    ],
  };
  const client = {
    auth: {
      signInWithPassword: async (args) => {
        calls.push({ login: args });
        return {
          data: {
            user: options.unconfirmed
              ? { ...user, email_confirmed_at: null }
              : user,
          },
          error: options.invalid ? { code: "invalid_credentials" } : null,
        };
      },
      signOut: async () => {
        calls.push({ logout: true });
        return { error: null };
      },
      getUser: async () => ({
        data: { user: options.noUser ? null : user },
        error: null,
      }),
      mfa: {
        challengeAndVerify: async (args) => {
          calls.push({ verify: args });
          return { error: null };
        },
      },
    },
  };
  const result = load(
    "src/app/api/portal/auth/route.ts",
    {
      "next/server": {
        NextResponse: {
          json: (value, init) => new Response(JSON.stringify(value), init),
        },
      },
      "node:crypto": { createHmac },
      zod: { z },
      "@/lib/supabase/auth-server": { authClient: async () => client },
      "@/lib/payments/checkout-server": {
        checkoutDatabase: () => ({
          rpc: async (name, args) => {
            calls.push({ rate: name, args });
            return { data: !options.limited, error: null };
          },
        }),
      },
      "@/lib/portal/server": {
        businessHeaders: { "Cache-Control": "private, no-store" },
        businessBody: async (request) => {
          if (
            !businessOrigin(
              request.headers.get("origin"),
              request.headers.get("host"),
              true,
            )
          )
            throw Error("forbidden");
          return request.json();
        },
      },
    },
    { CHECKOUT_REQUEST_SECRET: "x".repeat(32) },
  );
  return { ...result, calls };
}
function request(value, origin = "https://portal.mytripsim.com") {
  return new Request(origin + "/api/portal/auth", {
    method: "POST",
    headers: {
      origin,
      host: new URL(origin).host,
      "content-type": "application/json",
      "x-forwarded-for": "203.0.113.15",
    },
    body: JSON.stringify(value),
  });
}
test("login rate limiting precedes password verification and stores a hash only", async () => {
  const h = auth({ limited: true });
  const r = await h.POST(
    request({
      action: "login",
      email: "owner@example.invalid",
      password: "fixture-pass",
    }),
  );
  assert.equal(r.status, 429);
  assert.equal(
    h.calls.some((x) => x.login),
    false,
  );
  assert.match(h.calls[0].args.p_hash, /^[a-f0-9]{64}$/);
  assert.doesNotMatch(JSON.stringify(h.calls), /owner@example|203\.0\.113/);
});
test("unconfirmed logins clear the new local session, and MFA never trusts a supplied factor", async () => {
  const h = auth({ unconfirmed: true });
  assert.equal(
    (
      await h.POST(
        request({
          action: "login",
          email: "owner@example.invalid",
          password: "fixture-pass",
        }),
      )
    ).status,
    401,
  );
  assert.ok(h.calls.some((x) => x.logout));
  const m = auth();
  assert.equal(
    (
      await m.POST(
        request({ action: "mfa", code: "123456", factorId: "forged" }),
      )
    ).status,
    400,
  );
  assert.equal(m.calls.length, 0);
  assert.equal(
    (await m.POST(request({ action: "mfa", code: "123456" }))).status,
    200,
  );
  assert.equal(
    m.calls.find((x) => x.verify).verify.factorId,
    "22222222-2222-4222-8222-222222222222",
  );
});
test("successful login exposes no password or tokens; logout remains available when throttled", async () => {
  const h = auth();
  const r = await h.POST(
    request({
      action: "login",
      email: "owner@example.invalid",
      password: "fixture-pass",
    }),
  );
  assert.deepEqual(await r.json(), { ok: true, mfaRequired: true });
  const limited = auth({ limited: true });
  assert.equal((await limited.POST(request({ action: "logout" }))).status, 200);
  assert.equal(
    limited.calls.some((x) => x.rate),
    false,
  );
});
test("body guard enforces exact origins, JSON and streaming size limits", async () => {
  const server = load("src/lib/portal/server.ts", {
    "server-only": {},
    "next/headers": {},
    zod: { z },
    "@/lib/supabase/auth-server": {},
    "./business": { businessOrigin, workspaceSchema },
  });
  for (const input of [
    new Request("https://portal.mytripsim.com/api/portal", {
      method: "POST",
      headers: { origin: "https://evil.test", host: "portal.mytripsim.com" },
      body: "{}",
    }),
    new Request("https://portal.mytripsim.com/api/portal", {
      method: "POST",
      headers: {
        origin: "https://portal.mytripsim.com",
        host: "portal.mytripsim.com",
        "content-type": "application/json",
      },
      body: "x".repeat(8193),
    }),
  ])
    await assert.rejects(() => server.businessBody(input), /forbidden|invalid/);
  const body = await server.businessBody(request({ action: "logout" }));
  assert.equal(body.action, "logout");
});
