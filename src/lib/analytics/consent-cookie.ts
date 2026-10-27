import { createHmac, timingSafeEqual } from "node:crypto";
function signature(value: string, key: string) {
  return createHmac("sha256", key)
    .update("mts-stats-consent:" + value)
    .digest("hex");
}
export function encodeStatsPreference(choice: "yes" | "no", key: string) {
  const value = "v1." + choice;
  return value + "." + signature(value, key);
}
export function decodeStatsPreference(
  raw: string | null | undefined,
  key: string,
): "yes" | "no" | null {
  const match = /^(v1\.(yes|no))\.([a-f0-9]{64})$/.exec(raw ?? "");
  if (!match || key.length < 32) return null;
  const valid = timingSafeEqual(
    Buffer.from(match[3], "hex"),
    Buffer.from(signature(match[1], key), "hex"),
  );
  return valid ? (match[2] as "yes" | "no") : null;
}
