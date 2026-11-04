import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
async function inspect(session, changes = {}) {
  let calls = 0;
  const exports = {};
  const flags = {
    enabled: true,
    earnEnabled: true,
    redeemEnabled: true,
    publicEnabled: true,
    adminEnabled: true,
    persistenceReady: true,
    secret: "must-never-leave-server",
    ...changes,
  };
  const source = ts.transpileModule(
    readFileSync("src/app/api/admin/simcoins/status/route.ts", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    },
  ).outputText;
  vm.runInNewContext(source, {
    exports,
    process: { env: {} },
    require(name) {
      if (name === "next/server")
        return {
          NextResponse: {
            json: (body, options) => ({ body, status: options.status ?? 200 }),
          },
        };
      if (name === "@/lib/admin/server")
        return { adminSession: async () => session };
      if (name === "@/lib/simcoins/config")
        return { simcoinsFlags: () => flags };
      if (name === "@/lib/payments/checkout-server")
        return {
          paymentHeaders: {},
          paymentMode: () => changes.mode ?? "live",
          checkoutDatabase() {
            calls++;
            const q = {
              select: () => q,
              eq: () => q,
              single: async () => ({
                data: {
                  enabled: true,
                  earn_enabled: true,
                  redeem_enabled: true,
                  public_enabled: true,
                  admin_enabled: true,
                },
              }),
            };
            return { from: () => q };
          },
        };
      throw Error("unexpected_dependency");
    },
  });
  return { response: await exports.GET(), calls };
}
test("status requires an administrator with MFA before reading program settings", async () => {
  for (const [session, status] of [
    [{ user: null }, 401],
    [{ user: { id: "a" }, needsMfa: true, admin: true }, 428],
    [{ user: { id: "a" }, needsMfa: false, admin: false }, 403],
  ]) {
    const result = await inspect(session);
    assert.equal(result.response.status, status);
    assert.equal(result.calls, 0);
  }
});
test("status projects only operational booleans and effective earning/redemption honor runtime and live gates", async () => {
  const session = { user: { id: "a" }, needsMfa: false, admin: true };
  const result = await inspect(session);
  assert.equal(result.response.body.effective.earning, true);
  assert.equal(result.response.body.effective.redemption, true);
  assert.ok(
    Object.values(result.response.body.runtime).every(
      (v) => typeof v === "boolean",
    ),
  );
  assert.doesNotMatch(
    JSON.stringify(result.response.body),
    /must-never|secret|id/,
  );
  for (const changes of [{ mode: "test" }, { persistenceReady: false }]) {
    const r = await inspect(session, changes);
    assert.equal(r.response.body.effective.earning, false);
    assert.equal(r.response.body.effective.redemption, false);
  }
  const r = await inspect(session, { redeemEnabled: false });
  assert.equal(r.response.body.effective.earning, true);
  assert.equal(r.response.body.effective.redemption, false);
});
