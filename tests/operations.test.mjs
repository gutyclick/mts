import test from "node:test";
import assert from "node:assert/strict";
import { Webhook } from "svix";
import { randomBytes } from "node:crypto";
import {
  parseDeliveryEvent,
  canRetryNotification,
  alertEmail,
  notificationTimeout,
} from "../src/lib/operations/model.ts";
import { createEsimAccessAPI } from "../src/lib/integrations/esimaccess-api.ts";

test("slow provider and mail requests stay inside the worker deadline", () => {
  const deadline = 50000;
  const first = notificationTimeout(deadline, 20000);
  assert.equal(first, 15000);
  const second = notificationTimeout(deadline, 20000 + first);
  assert.equal(second, 12000);
  assert.equal(notificationTimeout(deadline, 47000), null);
  assert.ok(20000 + first + second < 60000);
});
test("signed delivery events are verified before projection and reject modifications, stale timestamps and missing signatures", () => {
  const secret = "whsec_" + randomBytes(32).toString("base64"),
    webhook = new Webhook(secret),
    id = "msg_fixture",
    now = new Date();
  const raw = JSON.stringify({
    type: "email.bounced",
    created_at: now.toISOString(),
    data: {
      email_id: "12345678-1234-4234-9234-123456789abc",
      to: ["private@example.invalid"],
      subject: "private QR",
      bounce: { message: "secret" },
    },
  });
  const headers = {
    "svix-id": id,
    "svix-timestamp": String(Math.floor(now.getTime() / 1000)),
    "svix-signature": webhook.sign(id, now, raw),
  };
  const event = parseDeliveryEvent(raw, headers, secret);
  assert.equal(event.type, "email.bounced");
  assert.ok(!JSON.stringify(event).includes("private"));
  assert.throws(() => parseDeliveryEvent(raw + " ", headers, secret));
  assert.throws(() => parseDeliveryEvent(raw, {}, secret));
  const old = new Date(Date.now() - 600000);
  assert.throws(() =>
    parseDeliveryEvent(
      raw,
      {
        ...headers,
        "svix-timestamp": String(Math.floor(old.getTime() / 1000)),
        "svix-signature": webhook.sign(id, old, raw),
      },
      secret,
    ),
  );
});
test("notification retries stop before upstream idempotency retention and never include customer credentials", () => {
  const now = Date.now();
  assert.equal(
    canRetryNotification(
      { attempts: 2, firstAttemptAt: new Date(now - 60000).toISOString() },
      now,
    ),
    true,
  );
  assert.equal(
    canRetryNotification(
      { attempts: 9, firstAttemptAt: new Date(now - 60000).toISOString() },
      now,
    ),
    false,
  );
  assert.equal(
    canRetryNotification(
      {
        attempts: 2,
        firstAttemptAt: new Date(now - 24 * 3600000).toISOString(),
      },
      now,
    ),
    false,
  );
  const email = alertEmail({
    kind: "paid_without_delivery",
    reference: "AABBCCDD",
    id: "12345678-1234-4234-9234-123456789abc",
    balanceUnits: null,
  });
  assert.match(email.text, /AABBCCDD/);
  assert.match(
    email.html,
    /https:\/\/www.mytripsim.com\/es\/admin\/operations/,
  );
  assert.ok(!email.text.includes("activation"));
});
test("provider account balance stays in documented ten-thousandth USD units without rounding or exposing upstream extras", async () => {
  const api = createEsimAccessAPI(
    { accessCode: "fixture-access", secretKey: "fixture-secret" },
    async (url) => {
      assert.equal(url, "https://api.esimaccess.com/api/v1/open/balance/query");
      return Response.json({
        success: true,
        errorCode: "0",
        obj: { balance: 2267220, secret: "private" },
      });
    },
  );
  assert.deepEqual(await api.balance(), {
    balanceUnits: 2267220,
    currency: "USD",
  });
});
