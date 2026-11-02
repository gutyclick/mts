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
function compile(path) {
  return ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
}
const compiled = compile("../src/lib/simcoins/checkout-server.ts");
const compiledCosts = compile("../src/lib/payments/promotion-costs.ts");
function harness({
  enabled = true,
  mode = "live",
  cost = true,
  spend = 0,
  refreshToken = null,
  providerPackages = null,
  providerMatches = [],
  saveError = false,
} = {}) {
  const calls = [],
    writes = [],
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
        upsert(rows, options) {
          calls.push("upsert:" + name);
          writes.push({ name, rows, options });
          return Promise.resolve({
            error: saveError ? { message: "fixture failure" } : null,
          });
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
        ? { data: refreshToken, error: null }
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
        calls.push("provider");
        if (providerPackages === null) throw Error("Unexpected provider call");
        return { privateCostPackages: async () => providerPackages };
      },
    },
    "../integrations/esimaccess-catalog": {
      compareProviderCatalog: (plans, remote) => {
        calls.push("provider-match");
        assert.equal(remote, providerPackages);
        assert.equal(plans[0].coverageCode, "JP");
        return { matches: providerMatches };
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
  // Execute the real shared implementation with the same database/provider
  // doubles, so extraction cannot hide missing refreshes or unwanted I/O.
  const costExports = {};
  vm.runInNewContext(compiledCosts, {
    exports: costExports,
    Date,
    AbortSignal,
    require: (name) => {
      const key =
        name === "./checkout-server" ? "../payments/checkout-server" : name;
      assert.ok(key in modules, key);
      return modules[key];
    },
  });
  modules["../payments/promotion-costs"] = costExports;
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
  return { ...exports, ...costExports, calls, writes };
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
  assert.ok(!api.calls.includes("simcoins_claim_cost_refresh"));
  assert.ok(!api.calls.includes("provider"));
});

const refreshPlans = [
  { id: "plan", allowance: "1GB", days: 7, coverage_code: "JP" },
];
test("shared cost refresher bypasses all I/O for verified fresh costs", async () => {
  const api = harness(),
    costs = [
      {
        plan_id: "plan",
        wholesale_unit_units: 10000,
        observed_at: new Date().toISOString(),
      },
    ];
  assert.equal(
    await api.refreshPromotionCosts(refreshPlans, costs, 900),
    costs,
  );
  assert.deepEqual(api.calls, []);
});
test("shared cost refresher saves matched provider costs under a lease and keeps unrelated costs", async () => {
  const token = "11111111-1111-4111-8111-111111111111";
  const api = harness({
    refreshToken: token,
    providerPackages: [{ slug: "JP_1_7", wholesaleUnitUnits: 12000 }],
    providerMatches: [{ planId: "plan", providerSlug: "JP_1_7" }],
  });
  const other = {
    plan_id: "other",
    wholesale_unit_units: 12345,
    observed_at: new Date().toISOString(),
  };
  const result = await api.refreshPromotionCosts(refreshPlans, [other], 900);
  assert.equal(result.length, 2);
  assert.equal(result[0], other);
  assert.equal(result[1].plan_id, "plan");
  assert.equal(result[1].wholesale_unit_units, 12000);
  assert.ok(Date.parse(result[1].observed_at) > Date.now() - 1000);
  assert.deepEqual(api.calls, [
    "database",
    "simcoins_claim_cost_refresh",
    "provider",
    "provider-match",
    "simcoins_private_costs",
    "upsert:simcoins_private_costs",
    "simcoins_release_cost_refresh",
  ]);
  assert.equal(api.writes.length, 1);
  assert.equal(api.writes[0].options.onConflict, "plan_id");
});
test("unavailable leases, provider failures, unmatched costs and failed saves never invent verified costs", async () => {
  for (const options of [
    {},
    { refreshToken: "11111111-1111-4111-8111-111111111111" },
    {
      refreshToken: "11111111-1111-4111-8111-111111111111",
      providerPackages: [{ slug: "JP_1_7", wholesaleUnitUnits: null }],
      providerMatches: [{ planId: "plan", providerSlug: "JP_1_7" }],
    },
    {
      refreshToken: "11111111-1111-4111-8111-111111111111",
      providerPackages: [{ slug: "JP_1_7", wholesaleUnitUnits: 12000 }],
      providerMatches: [{ planId: "plan", providerSlug: "JP_1_7" }],
      saveError: true,
    },
  ]) {
    const api = harness(options),
      stale = [
        {
          plan_id: "plan",
          wholesale_unit_units: 10000,
          observed_at: new Date(Date.now() - 901000).toISOString(),
        },
      ];
    assert.equal(
      await api.refreshPromotionCosts(refreshPlans, stale, 900),
      stale,
    );
    assert.equal(
      api.calls.includes("simcoins_release_cost_refresh"),
      Boolean(options.refreshToken),
    );
    if (!options.refreshToken) assert.ok(!api.calls.includes("provider"));
  }
});
