import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { compareProviderCatalog } from "../src/lib/integrations/esimaccess-catalog.ts";

const plans = ["JP_0.5_7", "JP_10_30"].map((id, i) => ({
  id,
  allowance: i ? "10GB" : "500MB",
  days: i ? 30 : 7,
  coverage_code: "JP",
}));
function harness({
  token = "11111111-1111-4111-8111-111111111111",
  concurrentlySaved = false,
} = {}) {
  const saved = [],
    calls = [];
  const db = {
    rpc: async (name) => {
      calls.push(name);
      return { data: token, error: null };
    },
    from: (table) => {
      let start = 0,
        end = 999;
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
        order() {
          return query;
        },
        range(a, b) {
          start = a;
          end = b;
          return query;
        },
        upsert: async (rows) => {
          saved.push(...rows);
          return { error: null };
        },
        then(resolve, reject) {
          return Promise.resolve({
            error: null,
            data:
              table === "catalog_plans"
                ? plans.slice(start, end + 1)
                : concurrentlySaved
                  ? [
                      {
                        plan_id: plans[0].id,
                        wholesale_unit_units: 1000,
                        observed_at: new Date().toISOString(),
                      },
                    ]
                  : [],
          }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const modules = {
    "server-only": {},
    zod: { z },
    "./checkout-server": { checkoutDatabase: () => db },
    "../integrations/esimaccess-catalog": { compareProviderCatalog },
    "../integrations/esimaccess-server": {
      esimAccess: () => ({
        privateCostPackages: async () => {
          calls.push("supplier");
          return plans.map((p, i) => ({
            slug: p.id,
            days: p.days,
            coverage: ["JP"],
            volumeBytes: i ? 10 * 1024 ** 3 : 500 * 1024 ** 2,
            packageCode: p.id,
            wholesaleUnitUnits: 1000,
          }));
        },
      }),
    },
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync("src/lib/payments/promotion-costs.ts", "utf8"),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      },
    ).outputText,
    {
      exports,
      Date,
      setTimeout,
      require: (name) => {
        assert.ok(modules[name], name);
        return modules[name];
      },
    },
  );
  return { ...exports, saved, calls };
}
test("one supplier refresh verifies both the requested cart and other published plans", async () => {
  const h = harness();
  const result = await h.refreshPromotionCosts([plans[0]], [], 900);
  assert.equal(
    result.find((c) => c.plan_id === plans[0].id)?.wholesale_unit_units,
    1000,
  );
  assert.equal(
    h.saved.some((c) => c.plan_id === plans[1].id),
    true,
    "the next cart must not fail during the global refresh cooldown",
  );
  assert.equal(h.calls.filter((c) => c === "supplier").length, 1);
});
test("a competing refresh reuses newly persisted costs instead of returning the stale input", async () => {
  const h = harness({ token: null, concurrentlySaved: true });
  const result = await h.refreshPromotionCosts([plans[0]], [], 900);
  assert.equal(result[0]?.plan_id, plans[0].id);
  assert.equal(h.calls.includes("supplier"), false);
});
