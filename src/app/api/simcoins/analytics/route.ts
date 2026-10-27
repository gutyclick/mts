import { NextRequest, NextResponse } from "next/server";
import {
  paymentHeaders,
  paymentOrigin,
  checkoutDatabase,
} from "@/lib/payments/checkout-server";
import { ensureStatsSession } from "@/lib/analytics/server";
import {
  simcoinsClientEventSchema,
  simcoinsEventPathAllowed,
} from "@/lib/simcoins/analytics";
import { simcoinsFlags } from "@/lib/simcoins/config";

export async function POST(request: NextRequest) {
  const reply = (status = 200) =>
    NextResponse.json(
      { accepted: status === 200 },
      { status, headers: paymentHeaders },
    );
  if (request.headers.get("origin") !== paymentOrigin()) return reply(403);
  if (!request.headers.get("content-type")?.startsWith("application/json"))
    return reply(400);
  if (Number(request.headers.get("content-length")) > 1024) return reply(413);
  let body;
  try {
    const text = await request.text();
    if (text.length > 1024) return reply(413);
    body = simcoinsClientEventSchema.parse(JSON.parse(text));
  } catch {
    return reply(400);
  }
  try {
    const referrer = new URL(request.headers.get("referer") ?? "");
    if (
      referrer.origin !== paymentOrigin() ||
      !simcoinsEventPathAllowed(body.kind, referrer.pathname)
    )
      return reply(403);
  } catch {
    return reply(403);
  }
  const flags = simcoinsFlags();
  if (
    !flags.persistenceReady ||
    (!flags.publicEnabled && body.kind !== "simcoins_checkout_redeem") ||
    (body.kind === "simcoins_checkout_redeem" && !flags.redeemEnabled)
  )
    return reply();
  try {
    const response = reply();
    const cohort = await ensureStatsSession(request, response);
    if (!cohort) return response;
    const result = await checkoutDatabase().rpc(
      "simcoins_record_client_event",
      { p_hash: cohort, p_kind: body.kind, p_nonce: body.nonce },
    );
    return result.error ? reply(503) : response;
  } catch {
    return reply(503);
  }
}
