import test from "node:test";
import assert from "node:assert/strict";
import { isPortalHost, portalRewrite } from "../src/lib/portal/routing.ts";
import {
  createTrip,
  summarizeTrips,
  requestTrip,
  reviewRequest,
  exampleTrips,
} from "../src/lib/portal/model.ts";
import { portalHref, portalScreen } from "../src/lib/portal/copy.ts";

test("all ES/EN screens have round-trip routes, without retail help redirects", () => {
  for (const locale of ["es", "en"]) {
    for (const view of [
      "home",
      "trips",
      "new",
      "trip",
      "request",
      "review",
      "team",
      "billing",
      "help",
      "access",
    ]) {
      const href = portalHref(locale, "", view, "example-trip");
      assert.equal(portalScreen(locale, href.split("/").slice(2)).view, view);
      assert.notEqual(href, "/es/ayuda");
      assert.notEqual(href, "/en/help");
    }
  }
  assert.equal(portalScreen("es", ["admin"]), null);
  assert.equal(portalScreen("es", ["viajes", ".."]), null);
  assert.equal(
    portalScreen("en", ["trips", "example-trip", "request", "extra"]),
    null,
  );
});

test("only the exact portal hostname selects the B2B surface", () => {
  assert.equal(isPortalHost("portal.mytripsim.com"), true);
  assert.equal(isPortalHost("PORTAL.MYTRIPSIM.COM:443"), true);
  for (const host of [
    "www.mytripsim.com",
    "mytripsim.com",
    "portal.mytripsim.com.evil.test",
    "evilportal.mytripsim.com",
    null,
  ])
    assert.equal(isPortalHost(host), false);
  assert.equal(portalRewrite("/"), "/portal/es");
  assert.equal(portalRewrite("/en/trips/europe"), "/portal/en/trips/europe");
  assert.equal(portalRewrite("/es/viajes"), "/portal/es/viajes");
  assert.equal(portalRewrite("/portal/es"), "/portal/es");
  assert.equal(portalRewrite("/admin"), "/portal/es/admin");
});

test("trip creation validates dates and capacity and does not imply issued eSIMs", () => {
  const input = {
    name: "Europa diciembre",
    destination: "Europa",
    departure: "2026-12-20",
    returning: "2026-12-30",
    travelers: 30,
    mode: "package",
  };
  const trip = createTrip(input, "draft-1");
  assert.equal(trip.travelers, 30);
  assert.equal(trip.assigned, 0);
  assert.equal(trip.activated, 0);
  assert.equal(trip.status, "draft");
  assert.throws(() => createTrip({ ...input, returning: "2026-12-19" }, "bad"));
  assert.throws(() => createTrip({ ...input, departure: "2026-02-30" }, "bad"));
  for (const travelers of [0, -1, 1.5, 10001, NaN])
    assert.throws(() => createTrip({ ...input, travelers }, "bad"));
});

test("requests and preview approvals never create delivery or activation", () => {
  const draft = createTrip(
    {
      name: "Tokyo",
      destination: "Japón",
      departure: "2026-12-20",
      returning: "2026-12-30",
      travelers: 30,
      mode: "individual",
    },
    "draft-2",
  );
  assert.throws(() => requestTrip(draft, 31, "10gb", "request-1"));
  const requested = requestTrip(draft, 25, "10gb", "request-1");
  assert.equal(requested.status, "pending");
  assert.equal(requested.request.quantity, 25);
  assert.throws(() => requestTrip(requested, 25, "10gb", "duplicate"));
  const approved = reviewRequest(requested, "approved");
  assert.equal(approved.status, "approved");
  assert.equal(approved.delivered, 0);
  assert.equal(approved.activated, 0);
  assert.throws(() => reviewRequest(approved, "approved"));
  assert.throws(() => requestTrip(draft, 10, "unknown", "bad"));
});

test("package requests cover the group, individual requests may cover fewer travelers", () => {
  const draft = createTrip(
    {
      name: "Package",
      destination: "España",
      departure: "2026-12-20",
      returning: "2026-12-30",
      travelers: 30,
      mode: "package",
    },
    "draft-3",
  );
  assert.throws(() => requestTrip(draft, 25, "5gb", "partial"));
  assert.equal(requestTrip(draft, 30, "5gb", "all").request.quantity, 30);
  const totals = summarizeTrips(exampleTrips);
  assert.ok(
    totals.activated <= totals.delivered &&
      totals.delivered <= totals.assigned &&
      totals.assigned <= totals.travelers,
  );
});
