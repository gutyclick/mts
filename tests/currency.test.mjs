import test from "node:test";
import assert from "node:assert/strict";
import {
  currencies,
  currencyCode,
  rateFromStripeBase,
  convertUsdMinor,
  formatMoney,
  paymentCartTotal,
  shouldFetchCurrencyQuote,
} from "../src/lib/currency.ts";
test("the currency registry has exactly the approved currencies and minor units", () => {
  assert.equal(currencies.length, 18);
  for (const c of ["JPY", "KRW", "CLP"])
    assert.equal(currencies.find((x) => x.code === c).decimals, 0);
  for (const x of currencies.filter(
    (x) => !["JPY", "KRW", "CLP"].includes(x.code),
  ))
    assert.equal(x.decimals, 2);
  assert.equal(currencyCode("BTC"), null);
  assert.equal(currencyCode("eur"), "EUR");
});
test("Stripe base rates are inverted with decimal-safe rounding, without own markup", () => {
  assert.equal(rateFromStripeBase(1.25), "8000000000");
  assert.equal(rateFromStripeBase(0.0008), "12500000000000");
  assert.equal(rateFromStripeBase(1e-5), "1000000000000000");
  for (const x of [0, -1, Infinity, NaN])
    assert.throws(() => rateFromStripeBase(x));
});
test("display and checkout share per-unit half-up rounding and true minor units", () => {
  assert.equal(convertUsdMinor(349, "JPY", "1502500000000"), 524);
  assert.equal(convertUsdMinor(100, "KRW", "14000000000000"), 1400);
  assert.equal(convertUsdMinor(100, "EUR", "9100000000"), 91);
  assert.equal(convertUsdMinor(1, "JPY", "1500000000000"), 2);
  assert.equal(
    paymentCartTotal([{ unit: 1, quantity: 3 }], "JPY", "1500000000000"),
    6,
  );
  assert.equal(convertUsdMinor(999, "USD", "10000000000"), 999);
  assert.match(formatMoney(1400, "KRW", "en"), /1,400/);
  assert.doesNotMatch(formatMoney(1400, "KRW", "en"), /1,400\.00/);
  assert.throws(() => convertUsdMinor(100, "USD", "garbage"));
});

test('a successful selected quote is not fetched again or discarded on a redundant network failure',()=>{const quote={currency:'EUR',quote:{expiresAt:new Date(Date.now()+3600000).toISOString()},error:false};assert.equal(shouldFetchCurrencyQuote('EUR',quote),false);assert.equal(shouldFetchCurrencyQuote('JPY',quote),true);assert.equal(shouldFetchCurrencyQuote('EUR',null),true);assert.equal(shouldFetchCurrencyQuote('EUR',{currency:'EUR',quote:null,error:true}),false);});
