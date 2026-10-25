import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createEsimAccessAPI } from "../src/lib/integrations/esimaccess-api.ts";
import {
  processFulfillment,
  deliveryToken,
  validDeliveryToken,
} from "../src/lib/fulfillment/core.ts";
import { deliveryEmail } from "../src/lib/fulfillment/email.ts";

const job = () => ({
  id: randomUUID(),
  order_id: randomUUID(),
  plan_id: "US_1_7",
  unit_index: 1,
  state: "queued",
  attempts: 1,
  provider_transaction_id: "mts_fixed_transaction",
  provider_order_no: null,
  provider_slug: "US_1_7",
  volume_bytes: 1073741824,
  days: 7,
  access_nonce: randomUUID(),
  created_at: new Date().toISOString(),
  email_started_at: null,
});
const order = {
  status: "paid",
  livemode: true,
  locale: "es",
  recipient_email: "recipient@example.invalid",
};
const profile = {
  transactionId: "TRAN1",
  orderNo: "B123",
  iccid: "89852245280001354019",
  smdpAddress: "rsp.example.com",
  activationCode: "PRIVATE_CODE",
  status: "GOT_RESOURCE",
  smdpStatus: "RELEASED",
  volumeBytes: 1073741824,
  usedBytes: 0,
  expiresAt: null,
  packageSlug: "US_1_7",
  days: 7,
  apn: null,
};
test("100 MB package aliases with decimal points are accepted without changing supplier identity", async () => {
  const api = createEsimAccessAPI(
    { accessCode: "access_12345678", secretKey: "secret_12345678" },
    async (_url, options) => {
      const body = JSON.parse(options.body);
      assert.equal(body.packageInfoList[0].packageCode, "PA_0.1_7");
      return Response.json({
        success: true,
        errorCode: "0",
        obj: { orderNo: "B100MB", transactionId: body.transactionId },
      });
    },
  );
  assert.equal(
    await api.purchaseProfile("PA_0.1_7", "mts_fixed_transaction"),
    "B100MB",
  );
});
test("only confirmed live payments issue; Stripe test, pending and disabled workers have no external effects", async () => {
  let calls = 0;
  const deps = {
    order: async () => order,
    buy: async () => {
      calls++;
      return "B123";
    },
    save: async () => {},
    profiles: async () => [],
    publish: async () => {},
    send: async () => "",
    enabled: false,
  };
  await processFulfillment(job(), deps);
  assert.equal(calls, 0);
  deps.enabled = true;
  for (const value of [
    { ...order, status: "pending" },
    { ...order, livemode: false },
  ]) {
    deps.order = async () => value;
    await processFulfillment(job(), deps);
  }
  assert.equal(calls, 0);
});
test("lost purchase response retries the same transaction and email retries never buy again", async () => {
  const j = job(),
    ids = [];
  let buys = 0,
    sends = 0,
    published = 0;
  const deps = {
    enabled: true,
    order: async () => order,
    buy: async (slug, id) => {
      ids.push(id);
      if (++buys === 1) throw new Error("timeout");
      return "B123";
    },
    save: async (patch) => Object.assign(j, patch),
    profiles: async () => [profile],
    publish: async () => {
      published++;
      j.state = "ready";
    },
    send: async () => {
      if (++sends === 1) throw new Error("timeout");
      return "mail1";
    },
  };
  await assert.rejects(processFulfillment(j, deps));
  await processFulfillment(j, deps);
  assert.deepEqual(ids, ["mts_fixed_transaction", "mts_fixed_transaction"]);
  assert.equal(j.state, "provider_pending");
  await processFulfillment(j, deps);
  assert.equal(published, 1);
  await assert.rejects(processFulfillment(j, deps));
  await processFulfillment(j, deps);
  assert.equal(j.state, "sent");
  assert.equal(buys, 2);
  assert.equal(sends, 2);
});
test("allocation is bound to one order and exact plan; incomplete allocation retries without repurchase", async () => {
  const j = { ...job(), state: "provider_pending", provider_order_no: "B123" };
  let published = 0;
  const deps = {
    enabled: true,
    order: async () => order,
    buy: async () => {
      throw new Error("must not buy");
    },
    save: async () => {},
    profiles: async () => [],
    publish: async () => published++,
    send: async () => "",
  };
  await processFulfillment(j, deps);
  assert.equal(published, 0);
  for (const change of [
    { orderNo: "other" },
    { packageSlug: "other" },
    { volumeBytes: 123 },
    { days: 30 },
    { activationCode: null },
  ]) {
    deps.profiles = async () => [{ ...profile, ...change }];
    await assert.rejects(processFulfillment(j, deps));
  }
  assert.equal(published, 0);
});
test("supplier orders use one immutable transaction, no customer email or retail prices", async () => {
  let body;
  const api = createEsimAccessAPI(
    { accessCode: "access_12345678", secretKey: "secret_12345678" },
    async (url, options) => {
      assert.ok(url.endsWith("/esim/order"));
      body = JSON.parse(options.body);
      return Response.json({
        success: true,
        errorCode: "0",
        obj: { orderNo: "B123", transactionId: body.transactionId },
      });
    },
  );
  assert.equal(
    await api.purchaseProfile("US_1_7", "mts_fixed_transaction"),
    "B123",
  );
  assert.deepEqual(body, {
    transactionId: "mts_fixed_transaction",
    packageInfoList: [{ packageCode: "US_1_7", count: 1 }],
  });
});
test("delivery tokens are unit-specific and mail escapes untrusted strings with no tracking", () => {
  const j = job(),
    secret = "s".repeat(64),
    token = deliveryToken(j, secret);
  assert.equal(validDeliveryToken(j, token, secret), true);
  assert.equal(
    validDeliveryToken({ ...j, id: randomUUID() }, token, secret),
    false,
  );
  assert.equal(validDeliveryToken(j, "0".repeat(64), secret), false);
  const mail = deliveryEmail({
    locale: "es",
    name: "<script>alert(1)</script>",
    dataGb: 1,
    days: 7,
    reference: "ABC",
    smdpAddress: "rsp.example.com",
    activationCode: "PRIVATE_CODE",
    link: "https://www.mytripsim.com/es/esim/access#private",
    qrContentId: "esim-qr",
  });
  assert.ok(mail.html.includes("&lt;script&gt;"));
  assert.ok(!mail.html.includes("<script>"));
  assert.ok(mail.html.includes("cid:esim-qr"));
  assert.ok(mail.text.includes("PRIVATE_CODE"));
  assert.ok(!mail.html.includes("utm_"));
});
