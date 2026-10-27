"use client";
import { statsPermissionAllowed } from "../analytics/client";
import {
  simcoinsEventPathAllowed,
  type SimcoinsClientEvent,
} from "./analytics";

// No account, balance, order, URL query or monetary data enters optional measurement.
export function recordSimcoinsStats(
  kind: SimcoinsClientEvent,
  nonce = crypto.randomUUID(),
) {
  if (
    typeof window === "undefined" ||
    !statsPermissionAllowed() ||
    !simcoinsEventPathAllowed(kind, window.location.pathname)
  )
    return false;
  void fetch("/api/simcoins/analytics", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind, nonce }),
    keepalive: true,
  }).catch(() => {});
  return true;
}

export function observeSimcoinsLanding() {
  const nonce = crypto.randomUUID();
  let sent = false;
  const record = () => {
    if (!sent) sent = recordSimcoinsStats("simcoins_landing_view", nonce);
  };
  record();
  window.addEventListener("mts:stats-permission", record);
  return () => window.removeEventListener("mts:stats-permission", record);
}
