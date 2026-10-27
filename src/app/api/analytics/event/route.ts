import { NextRequest, NextResponse } from "next/server";
import {
  paymentHeaders,
  paymentOrigin,
  checkoutDatabase,
} from "@/lib/payments/checkout-server";
import { clientEventSchema } from "@/lib/analytics/model";
import { ensureStatsSession } from "@/lib/analytics/server";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const reply = (status: number) =>
    NextResponse.json(
      { accepted: status === 200 },
      { status, headers: paymentHeaders },
    );
  if (request.headers.get("origin") !== paymentOrigin()) return reply(403);
  if (Number(request.headers.get("content-length")) > 1024) return reply(413);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 1024) return reply(413);
    body = clientEventSchema.parse(JSON.parse(raw));
  } catch {
    return reply(400);
  }
  try {
    const response = reply(200),
      cohort = await ensureStatsSession(request, response);
    if (!cohort) return response;
    const result = await checkoutDatabase().rpc("analytics_record_client", {
      p_hash: cohort,
      p_kind: body.kind,
      p_destination: body.destination,
    });
    if (result.error) return reply(503);
    return response;
  } catch {
    return reply(503);
  }
}
