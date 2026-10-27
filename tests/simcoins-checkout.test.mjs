import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  canonicalSimcoinsCart,
  simcoinsPaymentTotal,
  simcoinsQuoteRequestSchema,
} from "../src/lib/simcoins/checkout.ts";
import { checkoutRequestSchema } from "../src/lib/payments/checkout-core.ts";
import { legalVersion } from "../src/lib/legal-version.ts";
import { createEsimAccessAPI } from "../src/lib/integrations/esimaccess-api.ts";

test("SimCoins quote accepts only cart intent, never client money or account IDs", () => {
  const request = {
    lines: [{ destination: "japan", planId: "jp", quantity: 2 }],
    currency: "USD",
    fxQuoteId: null,
    useCoins: true,
  };
  assert.ok(simcoinsQuoteRequestSchema.safeParse(request).success);
  for (const field of [
    "earnedCoins",
    "wholesaleUnitUnits",
    "userId",
    "requestedCoins",
    "paymentTotal",
  ])
    assert.equal(
      simcoinsQuoteRequestSchema.safeParse({ ...request, [field]: 1 }).success,
      false,
    );
  assert.equal(
    simcoinsQuoteRequestSchema.safeParse({ ...request, currency: "JPY" })
      .success,
    false,
  );
});

test("cart identity is order-independent and quantity-sensitive", () => {
  const a = { destination: "japan", planId: "jp", quantity: 2 };
  const b = { destination: "france", planId: "fr", quantity: 1 };
  assert.equal(canonicalSimcoinsCart([a, b]), canonicalSimcoinsCart([b, a]));
  assert.notEqual(
    canonicalSimcoinsCart([a]),
    canonicalSimcoinsCart([{ ...a, quantity: 1 }]),
  );
});

test("net payments retain per-unit FX rounding including zero-decimal currencies", () => {
  assert.equal(
    simcoinsPaymentTotal(
      [{ netUnitCents: 101, quantity: 3 }],
      "JPY",
      "1500000000000",
    ),
    456,
  );
  assert.equal(
    simcoinsPaymentTotal(
      [{ netUnitCents: 101, quantity: 3 }],
      "USD",
      "10000000000",
    ),
    303,
  );
});

test("checkout only accepts an opaque SimCoins quote UUID", () => {
  const body = {
    attemptId: randomUUID(),
    locale: "es",
    email: "test@example.invalid",
    lines: [{ destination: "japan", planId: "jp", quantity: 1 }],
    expectedTotal: 500,
    compatible: true,
    terms: true,
    legalVersion,
  };
  assert.ok(checkoutRequestSchema.safeParse(body).success);
  assert.ok(
    checkoutRequestSchema.safeParse({ ...body, simcoinsQuoteId: randomUUID() })
      .success,
  );
  assert.equal(
    checkoutRequestSchema.safeParse({ ...body, simcoinsQuoteId: "forged" })
      .success,
    false,
  );
  assert.equal(
    checkoutRequestSchema.safeParse({ ...body, redeemedCoins: 25 }).success,
    false,
  );
});

test("private provider costs require explicit USD while the public catalog still strips costs", async () => {
  const fixture = {
    packageCode: "fixture",
    slug: "JP_1_7",
    name: "Japan",
    dataType: 1,
    volume: 1024 ** 3,
    duration: 7,
    durationUnit: "DAY",
    location: "JP",
    price: 10000,
  };
  const makeApi = (currencyCode) =>
    createEsimAccessAPI(
      { accessCode: "fixture-access", secretKey: "fixture-secret" },
      async () =>
        Response.json({
          success: true,
          obj: {
            packageList: [
              { ...fixture, ...(currencyCode ? { currencyCode } : {}) },
            ],
          },
        }),
    );
  assert.equal(
    (await makeApi("USD").privateCostPackages())[0].wholesaleUnitUnits,
    10000,
  );
  assert.equal(
    (await makeApi("EUR").privateCostPackages())[0].wholesaleUnitUnits,
    null,
  );
  assert.equal(
    (await makeApi(null).privateCostPackages())[0].wholesaleUnitUnits,
    null,
  );
  assert.equal(
    "wholesaleUnitUnits" in (await makeApi("USD").listFixedPackages())[0],
    false,
  );
  assert.equal("price" in (await makeApi("USD").listFixedPackages())[0], false);
});
