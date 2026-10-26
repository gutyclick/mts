// Explicit integration test: one disposable user, no email, no payments, no customer records read.
import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { authenticatorQr } from "../src/lib/admin/authenticator-qr.ts";
process.loadEnvFile(".env.local");
const base = process.env.ADMIN_TEST_BASE || "http://localhost:3008";
if (!/^http:\/\/localhost:\d+$/.test(base))
  throw Error("Local test server required");
const admin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_CHECKOUT_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const jar = new Map();
const client = createServerClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY,
  {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (values) =>
        values.forEach(({ name, value }) =>
          value ? jar.set(name, value) : jar.delete(name),
        ),
    },
  },
);
function check(error) {
  if (error) throw Error("Backend verification failed");
}
function code(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.toUpperCase().replace(/=+$/, "")) {
    const n = alphabet.indexOf(c);
    if (n < 0) throw Error("Invalid factor secret");
    bits += n.toString(2).padStart(5, "0");
  }
  const key = Buffer.from(
    (bits.match(/.{8}/g) || []).map((x) => parseInt(x, 2)),
  );
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", key).update(counter).digest();
  return String(
    (h.readUInt32BE(h.at(-1) & 15) & 0x7fffffff) % 1000000,
  ).padStart(6, "0");
}
const request = (path) =>
  fetch(base + path, {
    redirect: "manual",
    headers: { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join("; ") },
  });
let id,
  stage = "fixture creation",
  failed = false;
try {
  const email = `qa-admin-mfa-${randomBytes(10).toString("hex")}@example.invalid`,
    password = randomBytes(24).toString("base64url") + "aA9!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  check(error);
  id = data.user.id;
  stage = "member fixture";
  check((await admin.from("admin_memberships").insert({ user_id: id })).error);
  stage = "AAL1 login";
  check((await client.auth.signInWithPassword({ email, password })).error);
  stage = "AAL1 server denial";
  assert.equal((await request("/api/admin/data")).status, 428);
  assert.equal((await request("/api/admin/operations")).status, 428);
  const security = await request("/es/admin/security");
  assert.equal(security.status, 200);
  stage = "factor enrollment";
  const factor = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Disposable MFA test",
    issuer: "MyTripSim QA",
  });
  check(factor.error);
  const renderedQr = authenticatorQr(factor.data.totp.qr_code);
  assert.ok(renderedQr.startsWith("data:image/svg+xml;charset=utf-8,%3Csvg"));
  assert.ok(renderedQr.length < 1000000);
  stage = "incorrect code";
  const correct = code(factor.data.totp.secret),
    wrong = String((Number(correct) + 1) % 1000000).padStart(6, "0");
  assert.ok(
    (
      await client.auth.mfa.challengeAndVerify({
        factorId: factor.data.id,
        code: wrong,
      })
    ).error,
  );
  assert.equal((await request("/api/admin/data")).status, 428);
  stage = "MFA verification";
  check(
    (
      await client.auth.mfa.challengeAndVerify({
        factorId: factor.data.id,
        code: code(factor.data.totp.secret),
      })
    ).error,
  );
  assert.equal(
    (await client.auth.mfa.getAuthenticatorAssuranceLevel()).data.currentLevel,
    "aal2",
  );
  stage = "AAL2 server cookie persistence";
  // Status only; do not read or log real customer data returned by the existing admin API.
  const response = await request("/api/admin/data");
  assert.equal(response.status, 200);
  await response.body?.cancel();
  stage = "membership revocation";
  check(
    (await admin.from("admin_memberships").delete().eq("user_id", id)).error,
  );
  assert.equal((await request("/api/admin/data")).status, 403);
  console.log(
    "MFA integration passed: AAL1 denied, enrollment, incorrect code denied, AAL2 SSR cookie accepted, revoked membership denied. No email sent.",
  );
} catch {
  failed = true;
  console.error(`MFA integration failed at ${stage}. No credentials printed.`);
} finally {
  if (id) {
    const removed = await admin.auth.admin.deleteUser(id);
    if (removed.error) {
      failed = true;
      console.error("Disposable MFA fixture cleanup requires operator review.");
    } else console.log("Disposable MFA fixture removed.");
  }
  if (failed) process.exitCode = 1;
}
