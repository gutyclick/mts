import test from "node:test";
import assert from "node:assert/strict";
import {
  analyticsAllowed,
  clientEventSchema,
  destinationFromPath,
  validAnalyticsToken,
  publicStatsPath,
} from "../src/lib/analytics/model.ts";
import {
  encodeStatsPreference,
  decodeStatsPreference,
} from "../src/lib/analytics/consent-cookie.ts";
test("only server-signed preferences are accepted, without a per-person preference identifier", () => {
  const key = "fixture-key-".repeat(8),
    yes = encodeStatsPreference("yes", key),
    no = encodeStatsPreference("no", key);
  assert.equal(decodeStatsPreference(yes, key), "yes");
  assert.equal(decodeStatsPreference(no, key), "no");
  assert.equal(decodeStatsPreference("v1.yes", key), null);
  assert.equal(decodeStatsPreference(yes.replace("yes", "no"), key), null);
  assert.equal(decodeStatsPreference(yes, key + "x"), null);
  assert.equal(encodeStatsPreference("yes", key), yes);
});
test("statistics require affirmative consent and respect browser privacy signals", () => {
  for (const preference of [null, undefined, "v1.no", "yes", "v0.yes"])
    assert.equal(analyticsAllowed(preference, false, false), false);
  assert.equal(analyticsAllowed("v1.yes", false, false), true);
  assert.equal(analyticsAllowed("v1.yes", true, false), false);
  assert.equal(analyticsAllowed("v1.yes", false, true), false);
});
test("only canonical destination stages and fields are accepted; paid and sensitive fields are rejected", () => {
  assert.equal(
    clientEventSchema.safeParse({
      kind: "destination_view",
      destination: "panama",
    }).success,
    true,
  );
  for (const body of [
    { kind: "paid", destination: "panama" },
    {
      kind: "add_to_cart",
      destination: "panama",
      email: "private@example.invalid",
    },
    { kind: "destination_view", destination: "panama?qr=private" },
    { kind: "destination_view", destination: "https://example.invalid" },
  ])
    assert.equal(clientEventSchema.safeParse(body).success, false);
  assert.equal(destinationFromPath("/es/esim/panama"), "panama");
  for (const path of [
    "/es/esim/access",
    "/es/admin",
    "/en/support",
    "/en/esim/panama?secret=private",
    "/es/mis-esim",
    "/es/plan/panama/secret",
  ])
    assert.equal(destinationFromPath(path), null);
  assert.equal(validAnalyticsToken("a".repeat(64)), true);
  assert.equal(validAnalyticsToken("private"), false);
});

test("cart telemetry is blocked on private checkout, account, admin, support and installation pages", () => {
  for (const path of [
    "/es/compra",
    "/en/checkout",
    "/es/admin",
    "/en/support",
    "/es/mis-esim",
    "/en/install",
    "/es/esim/access",
    "/es/plan/panama/private",
  ])
    assert.equal(publicStatsPath(path), false);
  for (const path of ["/es", "/en/esim/panama", "/es/destinos"])
    assert.equal(publicStatsPath(path), true);
});
