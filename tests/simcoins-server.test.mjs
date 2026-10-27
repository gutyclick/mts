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
import { levelForSpend } from "../src/lib/simcoins/engine.ts";
const compiled = ts.transpileModule(
  readFileSync(
    new URL("../src/lib/simcoins/server.ts", import.meta.url),
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
  ready = false,
  failure = false,
  publicEnabled = false,
} = {}) {
  const calls = [],
    exports = {};
  const fields = {
    policyVersion: "policy_version",
    coinsPerUsd: "coins_per_usd",
    maxRedeemBps: "max_redeem_bps",
    minContributionBps: "min_contribution_bps",
    stripeBps: "stripe_bps",
    stripeFxBps: "stripe_fx_bps",
    fixedFeeUnits: "fixed_fee_units",
    affiliateBps: "affiliate_bps",
    maxPromotionBps: "max_promotion_bps",
    otherVariableUnits: "other_variable_units",
    costsMaxAgeSeconds: "costs_max_age_seconds",
    releaseDelaySeconds: "release_delay_seconds",
  };
  const settings = {
    ...Object.fromEntries(
      Object.entries(fields).map(([key, field]) => [
        field,
        defaultSimcoinsSettings[key],
      ]),
    ),
    enabled: true,
    earn_enabled: true,
    redeem_enabled: true,
    public_enabled: publicEnabled,
  };
  const db = {
    from(name) {
      calls.push(name);
      const q = {
        select() {
          return q;
        },
        eq() {
          return q;
        },
        single() {
          return q;
        },
        order() {
          return q;
        },
        then(resolve, reject) {
          return Promise.resolve({
            error: failure ? { code: "unavailable" } : null,
            data:
              name === "simcoins_program_settings"
                ? settings
                : defaultSimcoinsLevels.map((l) => ({
                    id: l.id,
                    name: l.name,
                    rate_bps: l.rateBps,
                    threshold_cents: l.thresholdCents,
                  })),
          }).then(resolve, reject);
        },
      };
      return q;
    },
  };
  const modules = {
    "server-only": {},
    zod: { z },
    "../payments/checkout-server": { checkoutDatabase: () => db },
    "./config": {
      defaultSimcoinsLevels,
      defaultSimcoinsSettings,
      simcoinsFlags: () => ({
        enabled: ready,
        earnEnabled: ready,
        redeemEnabled: ready,
        persistenceReady: ready,
        publicEnabled: true,
      }),
    },
    "./engine": { levelForSpend },
  };
  vm.runInNewContext(compiled, {
    exports,
    require: (name) => {
      assert.ok(name in modules, name);
      return modules[name];
    },
  });
  return { ...exports, calls };
}
test("pre-migration preview reads no database and makes no active rewards promise", async () => {
  const api = harness();
  const program = await api.getSimcoinsPublicProgram();
  assert.equal(program.publicEnabled, true);
  assert.equal(program.enabled, false);
  assert.equal(program.earnEnabled, false);
  assert.deepEqual(api.calls, []);
});
test("configured public visibility honors the database switch and fails closed on an outage", async () => {
  for (const options of [
    { ready: true, publicEnabled: false },
    { ready: true, publicEnabled: false, failure: true },
    { ready: true, publicEnabled: true, failure: true },
  ]) {
    const program = await harness(options).getSimcoinsPublicProgram();
    assert.equal(program.publicEnabled, false);
  }
  const program = await harness({
    ready: true,
    publicEnabled: true,
  }).getSimcoinsPublicProgram();
  assert.equal(program.publicEnabled, true);
  assert.equal(program.enabled, true);
  assert.ok(!JSON.stringify(program).includes("wholesale"));
});
