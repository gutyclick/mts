import test from "node:test";
import assert from "node:assert/strict";
import {
  businessAction,
  canManageTrips,
  canManageMembers,
  businessOrigin,
  toPortalTrip,
} from "../src/lib/portal/business.ts";

const id = "11111111-1111-4111-8111-111111111111";
test("business payloads never accept a spoofed actor or client-computed fulfillment", () => {
  const value = {
    action: "create_trip",
    companyId: id,
    id,
    name: "Europa",
    destination: "europe",
    departure: "2026-12-20",
    returning: "2026-12-30",
    travelers: 30,
    mode: "package",
  };
  assert.equal(businessAction.safeParse(value).success, true);
  for (const extra of [
    { userId: id },
    { role: "owner" },
    { activated: 30 },
    { approved: true },
    { price: 1 },
  ])
    assert.equal(
      businessAction.safeParse({ ...value, ...extra }).success,
      false,
    );
  assert.equal(
    businessAction.safeParse({ ...value, returning: "2026-12-19" }).success,
    false,
  );
  assert.equal(
    businessAction.safeParse({ ...value, departure: "2026-02-30" }).success,
    false,
  );
  assert.equal(
    businessAction.safeParse({ ...value, travelers: 1.5 }).success,
    false,
  );
});
test("finance cannot mutate trips; owners can manage existing members", () => {
  assert.equal(canManageTrips("owner"), true);
  assert.equal(canManageTrips("coordinator"), true);
  assert.equal(canManageTrips("finance"), false);
  assert.equal(canManageMembers("owner"), true);
  assert.equal(canManageMembers("coordinator"), false);
  assert.equal(canManageMembers("admin"), false);
});
test("business writes require matching exact allowed origin, not a sibling domain", () => {
  assert.equal(
    businessOrigin(
      "https://portal.mytripsim.com",
      "portal.mytripsim.com",
      true,
    ),
    true,
  );
  assert.equal(
    businessOrigin("https://www.mytripsim.com", "portal.mytripsim.com", true),
    false,
  );
  assert.equal(
    businessOrigin(
      "https://portal.mytripsim.com.evil.test",
      "portal.mytripsim.com",
      true,
    ),
    false,
  );
  assert.equal(businessOrigin(null, "portal.mytripsim.com", true), false);
  assert.equal(
    businessOrigin("http://127.0.0.1:3005", "127.0.0.1:3005", false),
    true,
  );
  assert.equal(
    businessOrigin("http://127.0.0.1:3005", "127.0.0.1:3005", true),
    false,
  );
});
test("durable trip DTO never claims issued, delivered, activated or sold eSIMs", () => {
  const trip = toPortalTrip(
    {
      id,
      name: "Europa",
      destination_slug: "europe",
      departure: "2026-12-20",
      returning: "2026-12-30",
      travelers: 30,
      mode: "package",
      version: 2,
      request: {
        id,
        plan_id: "EU-42_20_90",
        plan_name: "Europe 20GB 90Days",
        data_gb: 20,
        days: 90,
        quantity: 30,
        status: "approved",
        version: 1,
      },
    },
    "Europa",
  );
  assert.equal(trip.status, "approved");
  assert.equal(trip.assigned, 0);
  assert.equal(trip.delivered, 0);
  assert.equal(trip.activated, 0);
  assert.equal(trip.sold, 0);
  assert.equal(trip.request.plan, "EU-42_20_90");
});
