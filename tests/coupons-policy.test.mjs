import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  couponAdminRequestSchema,
  couponQuoteRequestSchema,
} from "../src/lib/payments/coupons.ts";
import { checkoutRequestSchema } from "../src/lib/payments/checkout-core.ts";
import { legalVersion } from "../src/lib/legal-version.ts";
const offer = {
  code: "VIAJE-5",
  name: "Campaña de noviembre",
  kind: "percent",
  value: 500,
  starts_at: null,
  ends_at: null,
  max_uses: 100,
  max_uses_per_customer: 1,
  minimum_cents: 1000,
  active: true,
};
test("admin coupon inputs reject invalid money, limits, reversed dates and unknown fields", () => {
  const parse = (value) =>
    couponAdminRequestSchema.safeParse({
      action: "save",
      request: randomUUID(),
      value,
    });
  assert.equal(parse(offer).success, true);
  assert.equal(parse({ ...offer, kind: "fixed", value: 500 }).success, true);
  assert.equal(
    parse({ ...offer, code: "  viaje-5  " }).data.value.code,
    "VIAJE-5",
  );
  for (const invalid of [
    { value: 0 },
    { value: 10001 },
    { value: 1.5 },
    { max_uses: 0 },
    { max_uses_per_customer: -1 },
    { minimum_cents: -1 },
    { code: "DISCOUNT<script>" },
    { name: "a".repeat(101) },
    { starts_at: "2026-11-02T00:00:00Z", ends_at: "2026-11-01T00:00:00Z" },
    { wholesale: 0 },
    { active: "true" },
  ])
    assert.equal(
      parse({ ...offer, ...invalid }).success,
      false,
      JSON.stringify(invalid),
    );
  assert.equal(
    parse({ ...offer, max_uses: null, max_uses_per_customer: null }).success,
    true,
  );
});
test("coupon quotes bind to a valid cart, email and the chosen currency snapshot", () => {
  const body = {
    code: "VIAJE-5",
    email: "guest@example.invalid",
    lines: [{ planId: "JP_1_7", destination: "japan", quantity: 1 }],
    currency: "USD",
    fxQuoteId: null,
  };
  assert.equal(couponQuoteRequestSchema.safeParse(body).success, true);
  for (const invalid of [
    { lines: [] },
    { email: "bad" },
    { currency: "EUR" },
    { currency: "USD", fxQuoteId: randomUUID() },
    { discountTotal: 1 },
    { identity_hash: "a".repeat(64) },
  ])
    assert.equal(
      couponQuoteRequestSchema.safeParse({ ...body, ...invalid }).success,
      false,
    );
  assert.equal(
    couponQuoteRequestSchema.safeParse({
      ...body,
      currency: "JPY",
      fxQuoteId: randomUUID(),
    }).success,
    true,
  );
});
test("checkout cannot stack a coupon and SimCoins or bypass consent", () => {
  const body = {
    attemptId: randomUUID(),
    locale: "es",
    email: "guest@example.invalid",
    lines: [{ planId: "JP_1_7", destination: "japan", quantity: 1 }],
    expectedTotal: 1000,
    expectedPaymentTotal: 950,
    couponQuoteId: randomUUID(),
    compatible: true,
    terms: true,
    legalVersion,
  };
  assert.equal(checkoutRequestSchema.safeParse(body).success, true);
  assert.equal(
    checkoutRequestSchema.safeParse({ ...body, simcoinsQuoteId: randomUUID() })
      .success,
    false,
  );
  assert.equal(
    checkoutRequestSchema.safeParse({ ...body, terms: false }).success,
    false,
  );
  assert.equal(
    checkoutRequestSchema.safeParse({ ...body, couponQuoteId: "forged" })
      .success,
    false,
  );
});
