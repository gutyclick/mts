import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { z } from "zod";
import {
  defaultSimcoinsSettings,
  defaultSimcoinsLevels,
} from "../src/lib/simcoins/config.ts";
import { buildSimcoinsQuote } from "../src/lib/simcoins/engine.ts";
import {
  canonicalSimcoinsCart,
  simcoinsPaymentTotal,
} from "../src/lib/simcoins/checkout.ts";
import { currencies, convertUsdMinor, usdRate } from "../src/lib/currency.ts";
const compiled = ts.transpileModule(
  readFileSync(
    new URL("../src/lib/simcoins/checkout-server.ts", import.meta.url),
    "utf8",
  ),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  },
).outputText;
function harness({
  enabled = true,
  mode = "live",
  cost = true,
  spend = 0,
} = {}) {
  const calls = [],
    exports = {};
  const table = {
    simcoins_program_settings: {
      enabled: true,
      earn_enabled: true,
      redeem_enabled: true,
    },
    catalog_plans: [
      {
        id: "plan",
        destination_slug: "japan",
        allowance: "1GB",
        days: 7,
        coverage_code: "JP",
        retail_price_cents: 1000,
      },
    ],
    simcoins_product_eligibility: [
      { plan_id: "plan", earn_enabled: true, redeem_enabled: true },
    ],
    simcoins_private_costs: cost
      ? [
          {
            plan_id: "plan",
            wholesale_unit_units: 10000,
            observed_at: new Date().toISOString(),
          },
        ]
      : [],
  };
  const db = {
    from(name) {
      calls.push(name);
      const query = {
        select() {
          return query;
        },
        eq() {
          return query;
        },
        in() {
          return query;
        },
        single() {
          return Promise.resolve({ data: table[name], error: null });
        },
        then(resolve, reject) {
          return Promise.resolve({ data: table[name], error: null }).then(
            resolve,
            reject,
          );
        },
      };
      return query;
    },
    async rpc(name) {
      calls.push(name);
      return name === "simcoins_claim_cost_refresh"
        ? { data: null, error: null }
        : {
            data: {
              id: "11111111-1111-4111-8111-111111111111",
              expiresAt: new Date(Date.now() + 300000).toISOString(),
            },
            error: null,
          };
    },
  };
  const modules = {
    "server-only": {},
    zod: { z },
    "../payments/checkout-server": {
      checkoutDatabase: () => {
        calls.push("database");
        return db;
      },
    },
    "../payments/checkout-mode": { paymentMode: () => mode },
    "../payments/checkout-core": { sha256: () => "a".repeat(64) },
    "../currency": { currencies, convertUsdMinor, usdRate },
    "../integrations/esimaccess-server": {
      esimAccess: () => {
        throw Error("Unexpected provider call");
      },
    },
    "../integrations/esimaccess-catalog": {
      compareProviderCatalog: () => {
        throw Error("Unexpected provider match");
      },
    },
    "./engine": { buildSimcoinsQuote },
    "./config": {
      simcoinsFlags: () => ({
        enabled,
        persistenceReady: enabled,
        earnEnabled: enabled,
        redeemEnabled: enabled,
      }),
    },
    "./server": {
      getSimcoinsSettings: async () => ({
        settings: defaultSimcoinsSettings,
        levels: defaultSimcoinsLevels,
      }),
      getCustomerSimcoins: async () => ({
        configured: true,
        wallet: { availableCoins: 0, eligibleSpendCents: spend },
      }),
    },
    "./checkout": { canonicalSimcoinsCart, simcoinsPaymentTotal },
  };
  vm.runInNewContext(compiled, {
    exports,
    process: { env: {} },
    Date,
    AbortSignal,
    require: (name) => {
      assert.ok(name in modules, name);
      return modules[name];
    },
  });
  return { ...exports, calls };
}
const request = {
  lines: [{ planId: "plan", destination: "japan", quantity: 1 }],
  currency: "USD",
  fxQuoteId: null,
  useCoins: false,
};
test("disabled rewards and Stripe test mode bypass all financial and provider reads", async () => {
  for (const options of [{ enabled: false }, { mode: "test" }]) {
    const api = harness(options);
    assert.equal(api.simcoinsCheckoutEnabled(), false);
    assert.equal(await api.createSimcoinsCheckoutQuote("user", request), null);
    assert.deepEqual(api.calls, []);
  }
});
test("unverified supplier cost gives no quote and does not interrupt ordinary checkout", async () => {
  const api = harness({ cost: false });
  assert.equal(await api.createSimcoinsCheckoutQuote("user", request), null);
  assert.ok(!api.calls.includes("simcoins_create_quote"));
});
test("first qualifying zero-rate purchase still receives a progress snapshot", async () => {
  const api = harness();
  const quote = await api.createSimcoinsCheckoutQuote("user", request);
  assert.equal(quote.earnedCoins, 0);
  assert.equal(quote.firstPurchase, true);
  assert.ok(api.calls.includes("simcoins_create_quote"));
});
