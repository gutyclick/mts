// Full native-form Server Action test. Disposable account only; never logs QR, OTP, cookies or passwords.
import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
process.loadEnvFile(".env.local");
const base = process.env.ADMIN_TEST_BASE || "http://localhost:3012";
if (!/^http:\/\/localhost:\d+$/.test(base))
  throw Error("Local test server required");
const admin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_CHECKOUT_SECRET_KEY,
    { auth: { persistSession: false } },
  ),
  jar = new Map();
const client = createServerClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_PUBLISHABLE_KEY,
  {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (a) =>
        a.forEach(({ name, value }) =>
          value ? jar.set(name, value) : jar.delete(name),
        ),
    },
  },
);
const cookies = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
function remember(response) {
  for (const header of response.headers.getSetCookie()) {
    const part = header.split(";")[0],
      i = part.indexOf("=");
    const k = part.slice(0, i),
      v = part.slice(i + 1);
    if (v) jar.set(k, v);
    else jar.delete(k);
  }
}
const decode = (v) =>
  v.replace(
    /&(quot|amp|lt|gt|apos|#39|#x27);/g,
    (_, n) =>
      ({
        quot: '"',
        amp: "&",
        lt: "<",
        gt: ">",
        apos: "'",
        "#39": "'",
        "#x27": "'",
      })[n],
  );
function fields(html) {
  const form = html.match(/<form\b[^>]*>([\s\S]*?)<\/form>/)?.[1];
  assert.ok(form);
  const body = new FormData();
  for (const tag of form.matchAll(/<input\b[^>]*>/g)) {
    const attrs = Object.fromEntries(
      [...tag[0].matchAll(/([\w$:-]+)="([^"]*)"/g)].map((x) => [
        x[1],
        decode(x[2]),
      ]),
    );
    if (attrs.type === "hidden" && attrs.name)
      body.append(attrs.name, attrs.value ?? "");
  }
  assert.ok([...body.keys()].some((x) => x.startsWith("$ACTION_")));
  return body;
}
async function post(body) {
  const r = await fetch(base + "/es/admin/security", {
    method: "POST",
    body,
    redirect: "manual",
    headers: { cookie: cookies(), origin: base },
  });
  remember(r);
  return r;
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
let id,
  stage = "fixture",
  failed = false;
try {
  const email =
      "qa-mfa-action-" + randomBytes(10).toString("hex") + "@example.invalid",
    password = randomBytes(24).toString("base64url") + "aA9!";
  const u = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  assert.ifError(u.error);
  id = u.data.user.id;
  assert.ifError(
    (await admin.from("admin_memberships").insert({ user_id: id })).error,
  );
  assert.ifError(
    (await client.auth.signInWithPassword({ email, password })).error,
  );
  stage = "initial form";
  const first = await fetch(base + "/es/admin/security", {
    headers: { cookie: cookies() },
  });
  assert.equal(first.status, 200);
  let html = await first.text();
  stage = "server enrollment and visible QR";
  const enroll = fields(html);
  enroll.set("action", "enroll");
  const enrolled = await post(enroll);
  assert.equal(enrolled.status, 200);
  html = await enrolled.text();
  assert.match(html, /<img[^>]+src="data:image\/svg\+xml/);
  const displayed = fields(html).get("factorId");
  assert.match(displayed, /^[a-f0-9-]{36}$/i);
  // Test verification with a fixture factor whose secret is known only in this process.
  // The real displayed factor is removed only from this disposable test user.
  assert.ifError(
    (await client.auth.mfa.unenroll({ factorId: displayed })).error,
  );
  const f = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Disposable action fixture",
  });
  assert.ifError(f.error);
  stage = "wrong code preserves form";
  const bad = fields(html);
  bad.set("action", "verify");
  bad.set("factorId", f.data.id);
  bad.set(
    "code",
    String((Number(code(f.data.totp.secret)) + 1) % 1000000).padStart(6, "0"),
  );
  const rejected = await post(bad);
  assert.equal(rejected.status, 200);
  html = await rejected.text();
  assert.equal(fields(html).get("factorId"), f.data.id);
  stage = "correct code action and cookie";
  const good = fields(html);
  good.set("code", code(f.data.totp.secret));
  const verified = await post(good);
  assert.ok([200, 303, 307].includes(verified.status));
  const granted = await fetch(base + "/api/admin/data", {
    headers: { cookie: cookies() },
  });
  assert.equal(granted.status, 200);
  await granted.body?.cancel();
  console.log(
    "Server Action integration passed: real enrollment renders private QR; invalid code retains verification; valid code persists AAL2 cookies.",
  );
} catch {
  failed = true;
  console.error(
    `MFA form integration failed at ${stage}. No private values printed.`,
  );
} finally {
  if (id) {
    const r = await admin.auth.admin.deleteUser(id);
    if (r.error) {
      failed = true;
      console.error("Disposable fixture cleanup requires review.");
    } else console.log("Disposable form fixture removed.");
  }
  if (failed) process.exitCode = 1;
}
