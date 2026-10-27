import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { paymentHeaders, paymentOrigin } from "@/lib/payments/checkout-server";
import {
  currentStatsHash,
  ensureStatsSession,
  privacySignal,
  setStatsPreference,
  statsConfigured,
  statsChoice,
  withdrawStats,
} from "@/lib/analytics/server";
import { statsPreferenceCookie } from "@/lib/analytics/model";
import { needsStatsWithdrawal } from "@/lib/analytics/withdrawal";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const blocked = privacySignal(request.headers),
    choice = statsChoice(request.cookies.get(statsPreferenceCookie)?.value),
    withdraw = needsStatsWithdrawal(
      choice,
      blocked,
      !!currentStatsHash(request),
    );
  const result = withdraw
    ? await withdrawStats(request)
    : { clearSession: false, cleanupPending: false };
  const response = NextResponse.json(
    {
      enabled: statsConfigured(),
      choice: blocked || withdraw ? "no" : choice,
      blocked,
      cleanupPending: result.cleanupPending,
    },
    { headers: paymentHeaders },
  );
  if (blocked || withdraw)
    setStatsPreference(response, "no", result.clearSession);
  return response;
}
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== paymentOrigin())
    return NextResponse.json(
      { error: "forbidden" },
      { status: 403, headers: paymentHeaders },
    );
  if (Number(request.headers.get("content-length")) > 1024)
    return NextResponse.json(
      { error: "invalid" },
      { status: 413, headers: paymentHeaders },
    );
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 1024) throw Error();
    body = z
      .object({ choice: z.enum(["yes", "no"]) })
      .strict()
      .parse(JSON.parse(raw));
  } catch {
    return NextResponse.json(
      { error: "invalid" },
      { status: 400, headers: paymentHeaders },
    );
  }
  const choice =
    body.choice === "yes" &&
    statsConfigured() &&
    !privacySignal(request.headers)
      ? "yes"
      : "no";
  const cleanup =
    choice === "no"
      ? await withdrawStats(request)
      : { clearSession: false, cleanupPending: false };
  const response = NextResponse.json(
    {
      choice,
      blocked: privacySignal(request.headers),
      cleanupPending: cleanup.cleanupPending,
    },
    { headers: paymentHeaders },
  );
  setStatsPreference(response, choice, cleanup.clearSession);
  if (choice === "yes") {
    try {
      await ensureStatsSession(request, response, true);
    } catch {
      /* Buying and browsing remain available even if optional measurement fails. */
    }
  }
  return response;
}
