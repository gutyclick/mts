import test from "node:test";
import assert from "node:assert/strict";
import { safeAccountNext } from "../src/lib/auth-routes.ts";
import {
  dashboardSection,
  dashboardFilter,
  filterDashboardEsims,
} from "../src/lib/customer-dashboard.ts";
test("account login keeps only known dashboard sections and filters", () => {
  assert.equal(
    safeAccountNext("/es/mis-esim?section=support&next=https://bad.test", "es"),
    "/es/mis-esim?section=support",
  );
  assert.equal(
    safeAccountNext("/en/my-esims?filter=active", "en"),
    "/en/my-esims?filter=active",
  );
  assert.equal(
    safeAccountNext("/es/mis-esim?section=unknown&filter=evil", "es"),
    "/es/mis-esim",
  );
});
test("dashboard accepts only its sections and keeps private eSIM details in the wallet", () => {
  assert.equal(dashboardSection("support"), "support");
  assert.equal(dashboardSection("orders"), "orders");
  assert.equal(dashboardSection("unknown"), "esims");
  assert.equal(dashboardSection("support", "private-id"), "esims");
  assert.equal(dashboardFilter("bad"), "all");
});
test("wallet filters keep ready, active and past eSIMs separate without hiding suspended records from all", () => {
  const records = [
    { id: "old", status: "expired" },
    { id: "using", status: "active" },
    { id: "install", status: "ready" },
    { id: "paused", status: "suspended" },
  ];
  assert.deepEqual(
    filterDashboardEsims(records, "all").map((r) => r.id),
    ["install", "using", "paused", "old"],
  );
  assert.deepEqual(
    filterDashboardEsims(records, "ready").map((r) => r.id),
    ["install"],
  );
  assert.deepEqual(
    filterDashboardEsims(records, "active").map((r) => r.id),
    ["using"],
  );
  assert.deepEqual(
    filterDashboardEsims(records, "ended").map((r) => r.id),
    ["old"],
  );
  assert.equal(records[0].id, "old");
});
