import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { applyPreviewPrices } from "../src/lib/catalog-preview-prices.ts";
const proposal = JSON.parse(
  fs.readFileSync("src/data/catalog-preview-prices.json", "utf8"),
);
const env = { CATALOG_REDESIGN_PREVIEW: "true" };
test("all 355 approved retail changes apply by ID and preserve original source objects", () => {
  assert.equal(Object.keys(proposal.prices).length, 355);
  for (const [id, p] of Object.entries(proposal.prices)) {
    assert.equal(p.proposedCents % 100, 0);
    assert.ok(p.proposedCents >= p.previousCents);
    const plan = { id, retailPriceCents: p.previousCents };
    const [result] = applyPreviewPrices([plan], env);
    assert.equal(result.retailPriceCents, p.proposedCents);
    assert.equal(plan.retailPriceCents, p.previousCents);
    assert.deepEqual(applyPreviewPrices([result], env), [result]);
  }
});
test("Brazil is ten dollars locally; production, CI and default never receive the proposal", () => {
  const plans = [{ id: "BR_3_30", retailPriceCents: 800 }];
  assert.equal(applyPreviewPrices(plans, env)[0].retailPriceCents, 1000);
  for (const disabled of [
    {},
    { ...env, VERCEL_ENV: "production" },
    { ...env, VERCEL: "1" },
    { ...env, CI: "true" },
  ])
    assert.strictEqual(applyPreviewPrices(plans, disabled), plans);
  assert.throws(
    () => applyPreviewPrices([{ id: "BR_3_30", retailPriceCents: 900 }], env),
    /stale/,
  );
  assert.equal(
    applyPreviewPrices([{ id: "unknown", retailPriceCents: 1200 }], env)[0]
      .retailPriceCents,
    1200,
  );
});
test("local payment guard precedes auth, order creation and Stripe calls; artifact has retail only", () => {
  const source = fs.readFileSync(
    "src/app/api/checkout/session/route.ts",
    "utf8",
  );
  const guard = source.indexOf("if (catalogPreviewEnabled(process.env))");
  assert.ok(
    guard > 0 && guard < source.indexOf("const client = await authClient()"),
  );
  assert.doesNotMatch(
    JSON.stringify(proposal),
    /wholesale|coste|secret|packageCode/i,
  );
});
