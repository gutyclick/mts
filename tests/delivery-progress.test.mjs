import test from "node:test";
import assert from "node:assert/strict";
import {
  canInstallDelivery,
  deliveryProgress,
} from "../src/lib/delivery-progress.ts";
import { shouldPollDelivery } from "../src/lib/esim-installation.ts";

test("an empty paid enqueue window never implies an installable eSIM", () => {
  assert.deepEqual(deliveryProgress([], 2), {
    total: 2,
    ready: 0,
    review: 0,
    testOnly: false,
    complete: false,
    partial: false,
  });
  assert.equal(deliveryProgress([]).complete, false);
});

test("email state is independent of authoritative installation availability", () => {
  for (const state of [
    "queued",
    "provider_pending",
    "ready",
    "sent",
    "review",
  ]) {
    assert.equal(
      canInstallDelivery({ state, installationReady: false }),
      false,
    );
    assert.equal(canInstallDelivery({ state, installationReady: true }), true);
  }
  assert.equal(canInstallDelivery({ state: "sent" }), false);
  assert.equal(
    canInstallDelivery({ state: "test_skipped", installationReady: true }),
    false,
  );
});

test("partial delivery includes not-yet-enqueued quantities and preserves installable review units", () => {
  const units = [
    { state: "sent", installationReady: true },
    { state: "review", installationReady: true },
    { state: "review", installationReady: false },
  ];
  assert.deepEqual(deliveryProgress(units, 4), {
    total: 4,
    ready: 2,
    review: 1,
    testOnly: false,
    complete: false,
    partial: true,
  });
  assert.equal(deliveryProgress(units.slice(0, 2), 2).complete, true);
  assert.equal(deliveryProgress(units, 1).total, 3);
});

test("test purchases never complete a delivery, including mixed test and real units", () => {
  assert.equal(deliveryProgress([{ state: "test_skipped" }], 1).testOnly, true);
  const mixed = deliveryProgress([
    { state: "test_skipped" },
    { state: "ready", installationReady: true },
  ]);
  assert.equal(mixed.testOnly, false);
  assert.equal(mixed.complete, false);
  assert.equal(mixed.partial, true);
});

test("legacy private QR details require complete credentials and cannot override false readiness", () => {
  const unit = {
    state: "sent",
    qr: "private",
    smdpAddress: "smdp.test",
    activationCode: "private",
  };
  assert.equal(canInstallDelivery(unit), true);
  assert.equal(
    canInstallDelivery({ ...unit, activationCode: undefined }),
    false,
  );
  assert.equal(
    canInstallDelivery({ ...unit, installationReady: false }),
    false,
  );
});

test("polling waits for missing units, stays bounded, and never waits on settled reviews", () => {
  assert.equal(shouldPollDelivery([{ state: "sent" }], 1, 2), true);
  assert.equal(shouldPollDelivery([{ state: "sent" }], 120, 2), false);
  assert.equal(shouldPollDelivery([{ state: "review" }], 1, 1), false);
});
