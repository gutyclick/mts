import test from "node:test";
import assert from "node:assert/strict";
import { fetchStripeRateSnapshot } from "../src/lib/payments/fx-rates.ts";
import { currencies } from "../src/lib/currency.ts";
test("pricing uses complete live informational base rates, no lock, customer data or own FX markup", async () => {
  const secret = "sk_" + "live_" + "x".repeat(24),
    rates = Object.fromEntries(
      currencies
        .filter((c) => c.code !== "USD")
        .map((c) => [
          c.code.toLowerCase(),
          { exchange_rate: 1.1, rate_details: { base_rate: 1.25 } },
        ]),
    );
  let request;
  const transport = async (url, init) => {
    request = { url, init };
    return Response.json({
      id: "fxq_fixture",
      created: Date.now() / 1000,
      to_currency: "usd",
      lock_duration: "none",
      rates,
    });
  };
  const snapshot = await fetchStripeRateSnapshot(secret, transport);
  assert.equal(
    snapshot.rates.EUR,
    "8000000000",
    "use base_rate, not the fee-inclusive exchange_rate",
  );
  assert.equal(Object.keys(snapshot.rates).length, 18);
  const body = request.init.body;
  assert.equal(body.get("lock_duration"), "none");
  assert.equal(body.get("to_currency"), "usd");
  assert.equal(body.getAll("from_currencies[]").length, 17);
  assert.equal(
    [...body.keys()].some((k) => /email|customer|amount/.test(k)),
    false,
  );
  assert.equal(request.url, "https://api.stripe.com/v1/fx_quotes");
  delete rates.jpy;
  await assert.rejects(fetchStripeRateSnapshot(secret, transport));
  await assert.rejects(
    fetchStripeRateSnapshot("sk_" + "test_" + "x".repeat(24), transport),
    /Live informational/,
  );
});
