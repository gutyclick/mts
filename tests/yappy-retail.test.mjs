import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import {
  yappyConfig,
  verifyYappyIpn,
  validateYappyMerchant,
} from "../src/lib/integrations/yappy.ts";
import {
  retailYappySettings,
  yappyContribution,
} from "../src/lib/payments/yappy-policy.ts";
const secret = Buffer.from("fixture-retail.key").toString("base64");
const env = {
  YAPPY_RETAIL_LIVE_MERCHANT_ID: "retail-fixture",
  YAPPY_RETAIL_LIVE_SECRET: secret,
  YAPPY_RETAIL_ENABLED: "true",
  YAPPY_RETAIL_PERSISTENCE_READY: "true",
  YAPPY_RETAIL_FEES_CONFIRMED: "true",
  YAPPY_RETAIL_FEE_BPS: "100",
  YAPPY_RETAIL_FIXED_CENTS: "0",
};
test("retail and business credentials are independent, including legacy business fallback", () => {
  assert.equal(
    yappyConfig(env, true, "retail").domain,
    "https://www.mytripsim.com",
  );
  assert.equal(yappyConfig(env, true, "business"), null);
  assert.equal(
    yappyConfig(
      { YAPPY_LIVE_MERCHANT_ID: "legacy", YAPPY_LIVE_SECRET: secret },
      true,
      "retail",
    ),
    null,
  );
  assert.equal(
    yappyConfig(
      { YAPPY_LIVE_MERCHANT_ID: "legacy", YAPPY_LIVE_SECRET: secret },
      true,
      "business",
    ).domain,
    "https://portal.mytripsim.com",
  );
  assert.equal(yappyConfig(env, false, "retail"), null);
  const config = yappyConfig(env, true, "retail");
  const input = {
    orderId: "abcdef123456789",
    status: "E",
    domain: config.domain,
  };
  const hash = createHmac("sha256", "fixture-retail")
    .update(input.orderId + input.status + input.domain)
    .digest("hex");
  assert.equal(verifyYappyIpn(config, { ...input, hash }), true);
  assert.equal(
    verifyYappyIpn(config, {
      ...input,
      domain: "https://portal.mytripsim.com",
      hash,
    }),
    false,
  );
  assert.equal(verifyYappyIpn(config, { ...input, status: "R", hash }), false);
});
test("readiness fails closed until credentials, fees and persistence are explicitly confirmed", () => {
  assert.ok(retailYappySettings(env, true));
  for (const name of [
    "YAPPY_RETAIL_LIVE_SECRET",
    "YAPPY_RETAIL_ENABLED",
    "YAPPY_RETAIL_PERSISTENCE_READY",
    "YAPPY_RETAIL_FEES_CONFIRMED",
    "YAPPY_RETAIL_FEE_BPS",
    "YAPPY_RETAIL_FIXED_CENTS",
  ]) {
    assert.equal(
      retailYappySettings({ ...env, [name]: undefined }, true),
      null,
    );
  }
  for (const fee of ["NaN", "-1", "0.93", "Infinity", "5001"])
    assert.equal(
      retailYappySettings({ ...env, YAPPY_RETAIL_FEE_BPS: fee }, true),
      null,
    );
});
test("profitability includes provider, fee, fixed cost, affiliate and maximum reward, with exact integer rounding", () => {
  assert.deepEqual(yappyContribution(1000, 40000, 100, 0), {
    eligible: true,
    contributionUnits: 45000,
  });
  assert.equal(yappyContribution(300, 24000, 100, 0).eligible, false);
  assert.equal(yappyContribution(1000, 70000, 100, 30).eligible, false);
  assert.throws(() => yappyContribution(0, 100, 100, 0));
  assert.throws(() => yappyContribution(100, NaN, 100, 0));
});
test("merchant verification calls only authorization endpoint, never payment creation", async () => {
  const calls = [];
  const result = await validateYappyMerchant(
    yappyConfig(env, true, "retail"),
    async (url, options) => {
      calls.push({ url, options });
      return Response.json({
        body: { token: "fixture-token", epochTime: 1700000000 },
      });
    },
  );
  assert.equal(result, true);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].url.endsWith("/payments/validate/merchant"));
  assert.equal(calls[0].options.redirect, "error");
});
