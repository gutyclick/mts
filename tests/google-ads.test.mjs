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
