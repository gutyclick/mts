import test from "node:test";
import assert from "node:assert/strict";
import {
  attemptStatsWithdrawal,
  needsStatsWithdrawal,
} from "../src/lib/analytics/withdrawal.ts";
test("withdrawal retries DB errors without losing its cleanup token", async () => {
  const bad = await attemptStatsWithdrawal("hash", async () => ({
    data: null,
    error: { message: "unavailable" },
  }));
  assert.deepEqual(bad, { clearSession: false, cleanupPending: true });
  const thrown = await attemptStatsWithdrawal("hash", async () => {
    throw Error("timeout");
  });
  assert.deepEqual(thrown, bad);
  assert.deepEqual(
    await attemptStatsWithdrawal("hash", async () => ({
      data: true,
      error: null,
    })),
    { clearSession: true, cleanupPending: false },
  );
  assert.deepEqual(
    await attemptStatsWithdrawal(null, async () => {
      throw Error("must not call");
    }),
    { clearSession: true, cleanupPending: false },
  );
});
test("a privacy signal withdraws an existing session, including a previously accepted one", () => {
  assert.equal(needsStatsWithdrawal("yes", true, true), true);
  assert.equal(needsStatsWithdrawal("no", false, true), true);
  assert.equal(needsStatsWithdrawal(null, false, false), false);
  assert.equal(needsStatsWithdrawal("yes", false, true), false);
});
