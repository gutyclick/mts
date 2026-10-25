import test from "node:test";
import assert from "node:assert/strict";
import { adminFilters, providerSnapshot } from "../src/lib/admin/model.ts";
import { safeAccountNext } from "../src/lib/auth-routes.ts";
test("admin filters are bounded and redirects remain local", () => {
  assert.equal(adminFilters.parse({}).tab, "summary");
  for (const input of [
    { tab: "secrets" },
    { q: "a".repeat(81) },
    { page: 0 },
    { user: "bad" },
    { environment: "secret" },
  ])
    assert.equal(adminFilters.safeParse(input).success, false);
  assert.equal(
    safeAccountNext("/es/admin?next=https://evil.invalid", "es"),
    "/es/admin",
  );
  assert.equal(
    safeAccountNext("https://evil.invalid/es/admin", "es"),
    "/es/mis-esim",
  );
});
test("status refresh binds profile identity and uses provider usage timestamps", () => {
  const expected = {
    orderNo: "B1",
    esimId: "T1",
    iccid: "89852245280001354019",
    volume: 1073741824,
  };
  const p = {
    orderNo: "B1",
    transactionId: "T1",
    iccid: expected.iccid,
    status: "IN_USE",
    smdpStatus: "ENABLED",
    volumeBytes: expected.volume,
    usedBytes: 10,
    expiresAt: "2026-12-01T00:00:00+0000",
  };
  const usage = {
    transactionId: "T1",
    usedBytes: 20,
    totalBytes: expected.volume,
    updatedAt: "2026-10-25T10:00:00+0000",
  };
  const result = providerSnapshot(expected, p, usage);
  assert.equal(result.used, 20);
  assert.equal(result.status, "IN_USE");
  assert.equal(result.usageAt, "2026-10-25T10:00:00.000Z");
  for (const patch of [
    { orderNo: "foreign" },
    { transactionId: "foreign" },
    { iccid: "foreign" },
    { volumeBytes: 5 },
  ])
    assert.throws(() => providerSnapshot(expected, { ...p, ...patch }, usage));
  assert.throws(() =>
    providerSnapshot(expected, p, { ...usage, transactionId: "foreign" }),
  );
  assert.equal(providerSnapshot(expected, p, null).usageAt, null);
});
