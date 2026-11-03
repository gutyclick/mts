"use client";
import {
  publicStatsPath,
  checkoutStatsPath,
  checkoutEventKinds,
  type CheckoutEventKind,
} from "./model";
let allowed = false;
export function browserStatsBlocked() {
  return (
    typeof navigator !== "undefined" &&
    (navigator.doNotTrack === "1" ||
      (navigator as Navigator & { globalPrivacyControl?: boolean })
        .globalPrivacyControl === true)
  );
}
export function setStatsPermission(value: boolean) {
  allowed = value && !browserStatsBlocked();
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event("mts:stats-permission"));
}
export function statsPermissionAllowed() {
  return allowed && !browserStatsBlocked();
}
// The server deduplicates each stage per short-lived consenting session.
// No checkout field, coupon code, error text, order or customer identifier is sent.
export function recordCheckoutStats(kind: CheckoutEventKind) {
  if (
    !statsPermissionAllowed() ||
    typeof window === "undefined" ||
    !checkoutStatsPath(window.location.pathname) ||
    !checkoutEventKinds.includes(kind)
  )
    return;
  void fetch("/api/analytics/event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind }),
    keepalive: true,
  }).catch(() => {});
}
export function recordStats(
  kind: "destination_view" | "add_to_cart",
  destination: string,
) {
  if (
    !allowed ||
    typeof window === "undefined" ||
    !publicStatsPath(window.location.pathname) ||
    browserStatsBlocked() ||
    !/^[-a-z0-9]{1,80}$/.test(destination)
  )
    return;
  void fetch("/api/analytics/event", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, destination }),
    keepalive: true,
  }).catch(() => {});
}
