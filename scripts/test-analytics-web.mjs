// Local integration: disposable analytics sessions/user only; no payments or emails.
import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
process.loadEnvFile(".env.local");
const base = process.env.ADMIN_TEST_BASE || "http://localhost:3000";
if (!/^http:\/\/localhost:\d+$/.test(base))
  throw Error("Local server required");
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_CHECKOUT_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const jar = new Map(),
  authJar = new Map(),
  hashes = new Set();
const client = createServerClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY,
  {
    cookies: {
      getAll: () => [...authJar].map(([name, value]) => ({ name, value })),
      setAll: (values) =>
        values.forEach(({ name, value }) =>
          value ? authJar.set(name, value) : authJar.delete(name),
        ),
    },
  },
);
const cookies = (map) => [...map].map(([k, v]) => k + "=" + v).join("; ");
function capture(r) {
  for (const entry of r.headers.getSetCookie()) {
    const field = entry.split(";")[0],
      split = field.indexOf("="),
      name = field.slice(0, split),
      value = field.slice(split + 1);
    if (value) jar.set(name, value);
    else jar.delete(name);
  }
  const token = jar.get("mts_stats_session");
  if (token)
    hashes.add(
      createHmac("sha256", process.env.ANALYTICS_HASH_SECRET)
        .update("mts-stats-session:" + token)
        .digest("hex"),
    );
}
async function req(path, body, extra = {}) {
  const r = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      cookie: cookies(jar),
      origin: base,
      "content-type": "application/json",
      ...extra,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  capture(r);
  return r;
}
const currentHash = () =>
  createHmac("sha256", process.env.ANALYTICS_HASH_SECRET)
    .update("mts-stats-session:" + jar.get("mts_stats_session"))
    .digest("hex");
const count = async (hash) =>
  (
    await db
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("cohort_hash", hash)
  ).count;
function check(error) {
  if (error) throw Error("Fixture operation failed");
}
function code(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of secret.toUpperCase().replace(/=+$/, ""))
    bits += alphabet.indexOf(c).toString(2).padStart(5, "0");
  const key = Buffer.from(bits.match(/.{8}/g).map((x) => parseInt(x, 2))),
    counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const h = createHmac("sha1", key).update(counter).digest();
  return String(
    (h.readUInt32BE(h.at(-1) & 15) & 0x7fffffff) % 1000000,
  ).padStart(6, "0");
}
let user,
  stage = "preference defaults",
  failed = false;
try {
  let r = await req("/api/analytics/consent");
  assert.equal((await r.json()).choice, null);
  assert.equal(jar.has("mts_stats_session"), false);
  await req("/api/analytics/event", {
    kind: "destination_view",
    destination: "panama",
  });
  assert.equal(jar.has("mts_stats_session"), false);
  await req("/api/analytics/consent", { choice: "no" });
  assert.equal(jar.has("mts_stats_session"), false);
  assert.equal(
    (
      await req(
        "/api/analytics/consent",
        { choice: "yes" },
        { origin: "https://wrong.invalid" },
      )
    ).status,
    403,
  );
  stage = "consented strict events";
  await req("/api/analytics/consent", { choice: "yes" });
  assert.equal(jar.has("mts_stats_session"), true);
  const first = currentHash();
  assert.equal(
    (await req("/api/analytics/event", { kind: "paid", destination: "panama" }))
      .status,
    400,
  );
  assert.equal(
    (
      await req("/api/analytics/event", {
        kind: "destination_view",
        destination: "panama",
        email: "not-stored@example.invalid",
      })
    ).status,
    400,
  );
  await req("/api/analytics/event", {
    kind: "destination_view",
    destination: "panama",
  });
  await req("/api/analytics/event", {
    kind: "destination_view",
    destination: "panama",
  });
  await req("/api/analytics/event", {
    kind: "add_to_cart",
    destination: "panama",
  });
  assert.equal(await count(first), 2);
  stage = "GPC withdrawal";
  r = await req("/api/analytics/consent", undefined, { "sec-gpc": "1" });
  assert.equal((await r.json()).choice, "no");
  assert.equal(jar.has("mts_stats_session"), false);
  assert.equal(await count(first), 0);
  assert.equal(
    (
      await db.rpc("analytics_start", {
        p_hash: first,
        p_bucket: "e".repeat(64),
      })
    ).data,
    false,
  );
  stage = "DNT rejection";
  r = await req("/api/analytics/consent", { choice: "yes" }, { dnt: "1" });
  assert.equal((await r.json()).choice, "no");
  assert.equal(jar.has("mts_stats_session"), false);
  stage = "manual withdrawal";
  await req("/api/analytics/consent", { choice: "yes" });
  const second = currentHash();
  await req("/api/analytics/event", {
    kind: "destination_view",
    destination: "panama",
  });
  assert.equal(await count(second), 1);
  await req("/api/analytics/consent", { choice: "no" });
  assert.equal(await count(second), 0);
  stage = "anonymous admin denied";
  assert.equal((await fetch(base + "/api/admin/analytics")).status, 401);
  const email =
      "qa-analytics-" + randomBytes(10).toString("hex") + "@example.invalid",
    password = randomBytes(24).toString("base64url") + "aA9!";
  const u = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  check(u.error);
  user = u.data.user.id;
  check((await client.auth.signInWithPassword({ email, password })).error);
  const report = () =>
    fetch(base + "/api/admin/analytics", {
      headers: { cookie: cookies(authJar) },
    });
  stage = "membership and MFA gates";
  assert.equal((await report()).status, 403);
  check((await db.from("admin_memberships").insert({ user_id: user })).error);
  assert.equal((await report()).status, 428);
  const factor = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Disposable analytics QA",
  });
  check(factor.error);
  check(
    (
      await client.auth.mfa.challengeAndVerify({
        factorId: factor.data.id,
        code: code(factor.data.totp.secret),
      })
    ).error,
  );
  r = await report();
  assert.equal(r.status, 200);
  assert.match(r.headers.get("cache-control"), /no-store/);
  const data = await r.json();
  assert.equal(typeof data.financial.grossCents, "number");
  assert.equal(typeof data.funnel.sessions, "number");
  assert.ok(!JSON.stringify(data).includes(user));
  for (const locale of ["es", "en"]) {
    r = await fetch(base + "/" + locale + "/admin/analytics", {
      headers: { cookie: cookies(authJar) },
    });
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.match(
      html,
      locale === "es" ? /Ventas y conversión/ : /Sales and conversion/,
    );
  }
  assert.equal(
    (
      await fetch(base + "/api/admin/analytics?days=999", {
        headers: { cookie: cookies(authJar) },
      })
    ).status,
    400,
  );
  console.log(
    "Analytics integration passed: no pre-consent session, strict events, deduplication, GPC/DNT and manual withdrawal, anonymous/membership/MFA gates and ES/EN private pages. No payments or emails.",
  );
} catch {
  failed = true;
  console.error(
    "Analytics integration failed at " + stage + "; no private data printed.",
  );
} finally {
  for (const hash of hashes) {
    check((await db.rpc("analytics_forget", { p_hash: hash })).error);
    check((await db.from("analytics_revoked").delete().eq("hash", hash)).error);
  }
  if (user) {
    check(
      (await db.from("admin_memberships").delete().eq("user_id", user)).error,
    );
    check((await db.auth.admin.deleteUser(user)).error);
  }
  await client.auth.signOut({ scope: "local" });
  if (failed) process.exitCode = 1;
}
