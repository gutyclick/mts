import test from "node:test";
import assert from "node:assert/strict";
import {
  expressWalletOptions,
  hasExpressWallet,
} from "../src/lib/payments/wallet-options.ts";

test("wallet options use official button variants and automatic eligibility", () => {
  assert.equal(expressWalletOptions.buttonHeight, 48);
  assert.deepEqual(expressWalletOptions.buttonTheme, {
    applePay: "black",
    googlePay: "black",
  });
  assert.deepEqual(expressWalletOptions.paymentMethodOrder, [
    "apple_pay",
    "google_pay",
    "link",
  ]);
  for (const method of ["applePay", "googlePay", "link"])
    assert.equal(expressWalletOptions.paymentMethods[method], "auto");
  for (const method of ["paypal", "amazonPay", "klarna"])
    assert.equal(expressWalletOptions.paymentMethods[method], "never");
  assert.equal(expressWalletOptions.layout.maxColumns, 2);
});
test("express section appears only for affirmative Stripe wallet availability", () => {
  for (const methods of [
    undefined,
    null,
    {},
    false,
    { applePay: false, googlePay: false, link: false },
    { googlePay: { available: false } },
    { paypal: true },
    { applePay: "true" },
  ])
    assert.equal(hasExpressWallet(methods), false);
  for (const method of ["applePay", "googlePay", "link"]) {
    assert.equal(hasExpressWallet({ [method]: true }), true);
    assert.equal(hasExpressWallet({ [method]: { available: true } }), true);
  }
});
