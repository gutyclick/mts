"use client";
import { publicStatsPath } from "./model";
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
