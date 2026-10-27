import test from "node:test";
import assert from "node:assert/strict";
import {
  installationLinks,
  isPreparingDelivery,
  shouldPollDelivery,
} from "../src/lib/esim-installation.ts";
test("direct installation preserves exact LPA on fixed official domains and rejects malformed credentials", () => {
  const links = installationLinks("smdp.example.test", "code_123-ABC");
  for (const [platform, host] of [
    ["ios", "esimsetup.apple.com"],
    ["android", "esimsetup.android.com"],
  ]) {
    const url = new URL(links[platform]);
    assert.equal(url.hostname, host);
    assert.equal(url.protocol, "https:");
    assert.equal(
      url.searchParams.get("carddata"),
      "LPA:1$smdp.example.test$code_123-ABC",
    );
  }
  for (const [s, c] of [
    ["evil.test/path", "code"],
    ["smdp.test", "code$injected"],
    ["", "code"],
    ["smdp.test", "a b"],
  ])
    assert.equal(installationLinks(s, c), null);
});
test("delivery polling survives the empty enqueue window and stops on settled units or deadline", () => {
  assert.equal(shouldPollDelivery([], 0), true);
  assert.equal(shouldPollDelivery([{ state: "queued" }], 3), true);
  assert.equal(shouldPollDelivery([{ state: "provider_pending" }], 3), true);
  assert.equal(shouldPollDelivery([{ state: "sent" }], 3), false);
  assert.equal(shouldPollDelivery([{ state: "review" }], 3), false);
  assert.equal(shouldPollDelivery([], 120), false);
});

test("wallet refresh survives a profile publication between its parallel reads", () => {
  assert.equal(isPreparingDelivery(["ready"], 0), true);
  assert.equal(isPreparingDelivery(["sent"], 0), true);
  assert.equal(isPreparingDelivery(["ready"], 1), false);
  assert.equal(isPreparingDelivery(["review"], 0), false);
  assert.equal(isPreparingDelivery(["test_skipped"], 0), false);
});
