import test from "node:test";
import assert from "node:assert/strict";
import {
  adsPreference,
  adsConsent,
  googleAdsPage,
} from "../src/lib/analytics/google-ads.ts";
test("advertising requires its own unexpired explicit choice, never historic internal stats consent", () => {
  const now = 1000000;
  for (const raw of [
    null,
    "v1.yes",
    "true",
    '{"choice":"yes"}',
    JSON.stringify({ choice: "yes", expires: now }),
    JSON.stringify({ choice: "yes", expires: now + 181 * 86400000 }),
  ])
    assert.equal(adsPreference(raw, now), null);
  assert.equal(
    adsPreference(
      JSON.stringify({ choice: "yes", expires: now + 86400000 }),
      now,
    ),
    "yes",
  );
  assert.equal(
    adsPreference(
      JSON.stringify({ choice: "no", expires: now + 86400000 }),
      now,
    ),
    "no",
  );
});
test("Google tag excludes private and credential-bearing routes in both languages", () => {
  for (const path of [
    "/es/mis-esim",
    "/en/my-esims",
    "/es/account/simcoins",
    "/es/admin",
    "/es/compra",
    "/en/checkout",
    "/es/esim/access",
    "/es/instalar",
    "/es/support",
    "/es/esim/japan?email=private",
  ])
    assert.equal(googleAdsPage(path), false, path);
  for (const path of [
    "/es",
    "/en",
    "/es/esim/japan",
    "/en/esim/europe",
    "/es/destinos",
    "/en/simcoins",
  ])
    assert.equal(googleAdsPage(path), true, path);
});
test("advertising consent never enables personalization or analytics storage", () => {
  assert.equal(adsConsent(true).ad_storage, "granted");
  assert.equal(adsConsent(true).ad_personalization, "denied");
  assert.equal(adsConsent(true).analytics_storage, "denied");
  assert.ok(Object.values(adsConsent(false)).every((x) => x === "denied"));
});
import vm from "node:vm";
import { googleAdsBootstrap } from "../src/lib/analytics/google-ads.ts";
test("advanced bootstrap denies every consent before initialization and never grants permissions or configures a destination", () => {
  const context = { window: {}, Date };
  vm.runInNewContext(googleAdsBootstrap, context);
  const commands = context.window.dataLayer.map((x) => Array.from(x));
  assert.equal(commands[0][0], "consent");
  assert.equal(commands[0][1], "default");
  assert.ok(Object.values(commands[0][2]).every((x) => x === "denied"));
  assert.equal(
    commands.findIndex((x) => x[0] === "js"),
    2,
  );
  assert.equal(
    commands.some(
      (x) => x[0] === "config" || Object.values(x[2] ?? {}).includes("granted"),
    ),
    false,
  );
  assert.equal(commands[1][1], "ads_data_redaction");
  assert.equal(commands[1][2], true);
});
