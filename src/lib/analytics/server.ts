import "server-only";
import { createHmac, randomBytes } from "node:crypto";
import { after, type NextRequest, type NextResponse } from "next/server";
import { checkoutDatabase } from "../payments/checkout-server";
import {
  statsPreferenceCookie,
  statsSessionCookie,
  validAnalyticsToken,
} from "./model";
import { decodeStatsPreference, encodeStatsPreference } from "./consent-cookie";
import { attemptStatsWithdrawal } from "./withdrawal";
export async function withdrawStats(request: NextRequest) {
  return attemptStatsWithdrawal(currentStatsHash(request), (cohort) =>
    checkoutDatabase()
      .rpc("analytics_forget", { p_hash: cohort })
      .abortSignal(AbortSignal.timeout(3000)),
  );
}
const key = () =>
  /^[a-f0-9]{64}$/.test(process.env.ANALYTICS_HASH_SECRET ?? "")
    ? process.env.ANALYTICS_HASH_SECRET!
    : null;
export function statsConfigured() {
  return process.env.ANALYTICS_ENABLED === "true" && key() !== null;
}
export function statsChoice(raw: string | undefined) {
  return decodeStatsPreference(raw, key() ?? "");
}
export function privacySignal(headers: Headers) {
  return headers.get("dnt") === "1" || headers.get("sec-gpc") === "1";
}
const hash = (value: string) =>
  createHmac("sha256", key()!)
    .update("mts-stats-session:" + value)
    .digest("hex");
export function currentStatsHash(request: NextRequest) {
  const raw = request.cookies.get(statsSessionCookie)?.value;
  return key() && validAnalyticsToken(raw) ? hash(raw) : null;
}
function permitted(request: NextRequest) {
  return (
    statsConfigured() &&
    !privacySignal(request.headers) &&
    statsChoice(request.cookies.get(statsPreferenceCookie)?.value) === "yes" &&
    !/(bot|crawler|spider|slurp|preview)/i.test(
      request.headers.get("user-agent") ?? "",
    )
  );
}
export function setStatsPreference(
  response: NextResponse,
  choice: "yes" | "no",
  clearSession = true,
) {
  const secret = key();
  response.cookies.set(
    statsPreferenceCookie,
    secret ? encodeStatsPreference(choice, secret) : "",
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: secret ? 180 * 86400 : 0,
    },
  );
  if (choice === "no" && clearSession)
    response.cookies.set(statsSessionCookie, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
}
export async function ensureStatsSession(
  request: NextRequest,
  response: NextResponse,
  explicitChoice = false,
) {
  if (
    !statsConfigured() ||
    privacySignal(request.headers) ||
    /(bot|crawler|spider|slurp|preview)/i.test(
      request.headers.get("user-agent") ?? "",
    ) ||
    (!explicitChoice && !permitted(request))
  )
    return null;
  const existing = request.cookies.get(statsSessionCookie)?.value,
    oldValid = validAnalyticsToken(existing);
  const address = (
    request.headers.get("x-vercel-forwarded-for") ??
    request.headers.get("x-forwarded-for") ??
    "unknown"
  )
    .split(",")[0]
    .trim()
    .slice(0, 200);
  const hour = new Date().toISOString().slice(0, 13),
    bucket = createHmac("sha256", key()!)
      .update("mts-stats-security:" + hour + ":" + address)
      .digest("hex");
  for (let attempt = 0; attempt < 1; attempt++) {
    const raw =
        oldValid && attempt === 0 ? existing : randomBytes(32).toString("hex"),
      cohort = hash(raw);
    const result = await checkoutDatabase()
      .rpc("analytics_start", {
        p_hash: cohort,
        p_bucket: bucket,
      })
      .abortSignal(AbortSignal.timeout(3000));
    if (result.error) throw Error("Measurement unavailable");
    if (result.data === true) {
      if (raw !== existing)
        response.cookies.set(statsSessionCookie, raw, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 1800,
        });
      return cohort;
    }
  }
  return null;
}
export function queueCheckoutMeasurement(request: NextRequest, order: string) {
  if (!permitted(request)) return;
  const cohort = currentStatsHash(request);
  if (!cohort) return;
  const startedAt = new Date().toISOString();
  try {
    after(async () => {
      try {
        await checkoutDatabase()
          .rpc("analytics_attach_checkout", {
            p_order: order,
            p_hash: cohort,
            p_started_at: startedAt,
          })
          .abortSignal(AbortSignal.timeout(3000));
      } catch {
        /* Optional metrics never delay or fail payment. */
      }
    });
  } catch {
    /* Scheduling failure is also optional. */
  }
}
