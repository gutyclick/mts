import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  yappyConfig,
  createYappyOrder,
  verifyYappyIpn,
  yappyScriptUrl,
  YappyRequestError,
} from "../src/lib/integrations/yappy.ts";

const secret = Buffer.from("fixture-key.metadata").toString("base64");
const config = yappyConfig(
  { YAPPY_TEST_MERCHANT_ID: "fixture-merchant", YAPPY_TEST_SECRET: secret },
  false,
);
const input = {
  orderId: "Ab123",
  totalCents: 1001,
  taxCents: 71,
  ipnUrl: `${config.origin}/api/yappy/ipn`,
};
test("provider rejection preserves only safe stage, status and code for diagnosis", async () => {
  let count = 0;
  await assert.rejects(
    createYappyOrder(config, input, async () => {
      if (++count === 1)
        return Response.json({
          body: { token: "fixture-token", epochTime: 1730000000 },
        });
      return Response.json(
        { status: { code: "YAPPY-004", description: secret }, body: null },
        { status: 400 },
      );
    }),
    (e) =>
      e instanceof YappyRequestError &&
      e.stage === "order" &&
      e.httpStatus === 400 &&
      e.providerCode === "YAPPY-004" &&
      !JSON.stringify(e).includes(secret),
  );
});
const sign = (orderId, status, domain) =>
  createHmac("sha256", "fixture-key")
    .update(orderId + status + domain)
    .digest("hex");

test("config isolates live and sandbox credentials and validates secrets/domains", () => {
  assert.equal(
    yappyConfig(
      { YAPPY_TEST_MERCHANT_ID: "a", YAPPY_TEST_SECRET: secret },
      true,
    ),
    null,
  );
  for (const invalid of [
    "",
    "???",
    Buffer.from(".empty").toString("base64"),
    Buffer.from([255]).toString("base64"),
  ]) {
    assert.equal(
      yappyConfig(
        { YAPPY_TEST_MERCHANT_ID: "a", YAPPY_TEST_SECRET: invalid },
        false,
      ),
      null,
    );
  }
  for (const domain of [
    "http://example.com",
    "https://user:pass@example.com",
    "https://example.com/path",
    "https://example.com?x=1",
  ]) {
    assert.equal(
      yappyConfig(
        {
          YAPPY_TEST_MERCHANT_ID: "a",
          YAPPY_TEST_SECRET: secret,
          YAPPY_DOMAIN: domain,
        },
        false,
      ),
      null,
    );
  }
  assert.equal(
    yappyScriptUrl(true),
    "https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js",
  );
  assert.equal(
    yappyScriptUrl(false),
    "https://bt-cdn-uat.yappycloud.com/v1/cdn/web-component-btn-yappy.js",
  );
});

test("creation uses fixed endpoints, raw token, exact integer money and validated provider epoch", async () => {
  const requests = [];
  const result = await createYappyOrder(config, input, async (url, options) => {
    requests.push({ url, options, body: JSON.parse(options.body) });
    return Response.json({
      body:
        requests.length === 1
          ? { token: "auth-token", epochTime: 1730000000 }
          : {
              transactionId: "transaction",
              token: "browser-token",
              documentName: "document",
            },
    });
  });
  assert.deepEqual(result, {
    transactionId: "transaction",
    token: "browser-token",
    documentName: "document",
  });
  assert.equal(
    requests[0].url,
    "https://api-comecom-uat.yappycloud.com/payments/validate/merchant",
  );
  assert.deepEqual(requests[0].body, {
    merchantId: config.merchantId,
    urlDomain: config.domain,
  });
  assert.equal(
    requests[1].url,
    "https://api-comecom-uat.yappycloud.com/payments/payment-wc",
  );
  assert.equal(requests[1].options.headers.Authorization, "auth-token");
  assert.deepEqual(requests[1].body, {
    merchantId: config.merchantId,
    orderId: "Ab123",
    domain: config.domain,
    paymentDate: 1730000000,
    ipnUrl: input.ipnUrl,
    discount: "0.00",
    taxes: "0.71",
    subtotal: "9.30",
    total: "10.01",
  });
  for (const request of requests) {
    assert.equal(request.options.redirect, "error");
    assert.equal(request.options.cache, "no-store");
    assert.ok(request.options.signal instanceof AbortSignal);
  }
});

test("invalid orders fail before making any request", async () => {
  for (const patch of [
    { orderId: "bad-id" },
    { orderId: "a".repeat(16) },
    { totalCents: 0 },
    { totalCents: 1.1 },
    { totalCents: Number.MAX_SAFE_INTEGER + 1 },
    { taxCents: -1 },
    { taxCents: 1002 },
    { ipnUrl: "https://elsewhere.com/ipn" },
  ]) {
    await assert.rejects(
      createYappyOrder(config, { ...input, ...patch }, () => {
        assert.fail("unexpected request");
      }),
      /Invalid Yappy/,
    );
  }
});

test("provider errors, oversized payloads and malformed schemas stay sanitized", async () => {
  for (const response of [
    new Response("sensitive-provider-value", { status: 400 }),
    Response.json({
      body: { token: "sensitive-provider-value", epochTime: "123" },
    }),
    new Response("x".repeat(32769)),
    Response.json({ body: [] }),
  ]) {
    await assert.rejects(
      createYappyOrder(config, input, async () => response),
      (error) => !error.message.includes("sensitive-provider-value"),
    );
  }
  await assert.rejects(
    createYappyOrder(config, input, async () => {
      throw new Error(secret);
    }),
    /Yappy service request failed/,
  );
});

test("IPN authenticates every official state and rejects forged or ambiguous callback parameters", () => {
  for (const status of ["E", "R", "C", "X"]) {
    const callback = {
      orderId: input.orderId,
      status,
      domain: config.domain,
      hash: sign(input.orderId, status, config.domain),
    };
    assert.equal(verifyYappyIpn(config, callback), true);
    assert.equal(
      verifyYappyIpn(config, {
        ...callback,
        hash: callback.hash.toUpperCase(),
      }),
      true,
    );
    for (const patch of [
      { status: "e" },
      { status: "success" },
      { status: [status] },
      { domain: `${config.domain}/` },
      { domain: "https://forged.com" },
      { orderId: [input.orderId] },
      { orderId: "other" },
      { hash: "0".repeat(64) },
      { hash: callback.hash.slice(1) },
      { hash: [callback.hash] },
    ]) {
      assert.equal(verifyYappyIpn(config, { ...callback, ...patch }), false);
    }
    assert.equal(
      verifyYappyIpn({ ...config, secret: "malformed" }, callback),
      false,
    );
  }
});
