// Local API/SSR integration with disposable Stripe-test records. Never calls approval/execution or Stripe.
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
process.loadEnvFile(".env.local");
const base = process.env.ADMIN_TEST_BASE || "http://localhost:3013";
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
      setAll: (values) =>
        values.forEach(({ name, value }) =>
          value ? jar.set(name, value) : jar.delete(name),
        ),
    },
  },
);
const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
const get = () =>
  fetch(base + "/api/admin/refunds?order=" + order, {
    headers: { cookie: cookie() },
  });
const expectedOrigin = new URL(
  process.env.CHECKOUT_SITE_URL ?? process.env.AUTH_SITE_URL ?? base,
).origin;
const post = (body, origin = expectedOrigin) =>
  fetch(base + "/api/admin/refunds", {
    method: "POST",
    headers: { cookie: cookie(), origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
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
const order = randomUUID(),
  unit = randomUUID(),
  nonce = randomBytes(10).toString("hex"),
  plan = "QA_REFUND_" + nonce;
let user,
  createdOrder = false,
  stage = "fixture",
  failed = false;
try {
  const email = `qa-refund-${nonce}@example.invalid`,
    password = randomBytes(24).toString("base64url") + "aA9!";
  const u = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  check(u.error);
  user = u.data.user.id;
  check((await client.auth.signInWithPassword({ email, password })).error);
  stage = "nonmember denied";
  assert.equal((await get()).status, 403);
  check(
    (await admin.from("admin_memberships").insert({ user_id: user })).error,
  );
  stage = "AAL1 denied";
  assert.equal((await get()).status, 428);
  const f = await client.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "Disposable refund test",
  });
  check(f.error);
  check(
    (
      await client.auth.mfa.challengeAndVerify({
        factorId: f.data.id,
        code: code(f.data.totp.secret),
      })
    ).error,
  );
  stage = "test-only order";
  check(
    (
      await admin.from("checkout_orders").insert({
        id: order,
        user_id: user,
        recipient_email: email,
        billing_email: email,
        browser_hash: "a".repeat(64),
        ip_hash: "b".repeat(64),
        fingerprint: "c".repeat(64),
        locale: "es",
        status: "paid",
        amount_total: 123,
        currency: "usd",
        livemode: false,
        stripe_payment_intent: "pi_qa_refund_" + nonce,
      })
    ).error,
  );
  createdOrder = true;
  check(
    (
      await admin.from("checkout_order_items").insert({
        order_id: order,
        plan_id: plan,
        destination_slug: "panama",
        destination_name: { es: "Panamá", en: "Panama" },
        plan_name: "Disposable refund fixture",
        data_gb: 1,
        days: 7,
        quantity: 1,
        unit_amount: 123,
        stripe_price_id: "price_qa_refund_" + nonce,
      })
    ).error,
  );
  check(
    (
      await admin.from("esim_fulfillments").insert({
        id: unit,
        order_id: order,
        plan_id: plan,
        unit_index: 1,
        state: "test_skipped",
        qa_authorized: false,
        volume_bytes: 1073741824,
        days: 7,
        provider_transaction_id: "mts_qa_refund_" + nonce,
      })
    ).error,
  );
  stage = "origin and immutable amount";
  const body = {
    action: "request",
    order,
    units: [unit],
    reason: "Disposable internal API test; no actual refund",
  };
  assert.equal((await post(body, "https://evil.invalid")).status, 403);
  assert.equal((await post({ ...body, amount: 999999 })).status, 400);
  const made = await post(body);
  assert.equal(made.status, 200);
  const requestId = (await made.json()).id;
  assert.match(requestId, /^[a-f0-9-]{36}$/);
  stage = "protected view";
  const view = await get();
  assert.equal(view.status, 200);
  const result = await view.json();
  assert.equal(result.recent.find((r) => r.id === requestId).amount, 123);
  assert.equal(result.order.units[0].reserved, requestId);
  assert.ok(!JSON.stringify(result).includes("payment_intent"));
  stage = "localized SSR";
  for (const locale of ["es", "en"]) {
    const r = await fetch(`${base}/${locale}/admin/refunds?order=${order}`, {
      headers: { cookie: cookie() },
    });
    assert.equal(r.status, 200);
    const html = await r.text();
    assert.ok(html.includes("Disposable refund fixture"));
    assert.ok(
      html.includes(
        locale === "es" ? "Revisar y autorizar" : "Review and approve",
      ),
    );
    assert.ok(!html.includes("pi_qa_refund_"));
  }
  stage = "request rejection";
  assert.equal((await post({ action: "reject", id: requestId })).status, 200);
  const after = await (await get()).json();
  assert.equal(after.order.units[0].reserved, null);
  assert.equal(after.recent.find((r) => r.id === requestId).state, "rejected");
  assert.ok(after.audit.some((a) => a.action === "rejected"));
  console.log(
    "Refund integration passed: nonmembers/AAL1/origin denied, amounts server-calculated, reservations, ES/EN SSR and rejection/audit. No approval, Stripe API call or actual refund.",
  );
} catch {
  failed = true;
  console.error(
    `Refund integration failed at ${stage}. No private values printed.`,
  );
} finally {
  try {
    if (createdOrder) {
      const req = await admin
        .from("refund_requests")
        .select("id")
        .eq("order_id", order);
      check(req.error);
      const ids = req.data.map((x) => x.id);
      if (ids.length) {
        check(
          (await admin.from("refund_audit").delete().in("request_id", ids))
            .error,
        );
        check(
          (await admin.from("refund_units").delete().in("request_id", ids))
            .error,
        );
        check(
          (await admin.from("refund_requests").delete().eq("order_id", order))
            .error,
        );
      }
      check(
        (await admin.from("esim_fulfillments").delete().eq("order_id", order))
          .error,
      );
      check(
        (
          await admin
            .from("checkout_order_items")
            .delete()
            .eq("order_id", order)
        ).error,
      );
      check(
        (await admin.from("checkout_orders").delete().eq("id", order)).error,
      );
    }
    if (user) check((await admin.auth.admin.deleteUser(user)).error);
    console.log("Disposable refund fixtures removed.");
  } catch {
    failed = true;
    console.error("Disposable refund cleanup requires operator review.");
  }
  if (failed) process.exitCode = 1;
}
