import { NextRequest, NextResponse } from "next/server";
import { parseDeliveryEvent } from "@/lib/operations/model";
import {
  checkoutDatabase,
  paymentHeaders,
} from "@/lib/payments/checkout-server";
export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const reply = (status: number) =>
    NextResponse.json(
      { received: status === 200 },
      { status, headers: paymentHeaders },
    );
  if (!process.env.RESEND_WEBHOOK_SECRET) return reply(503);
  if (Number(request.headers.get("content-length")) > 262144) return reply(413);
  let event;
  try {
    const raw = await request.text();
    if (raw.length > 262144) return reply(413);
    event = parseDeliveryEvent(
      raw,
      Object.fromEntries(
        ["svix-id", "svix-timestamp", "svix-signature"].map((name) => [
          name,
          request.headers.get(name) ?? "",
        ]),
      ),
      process.env.RESEND_WEBHOOK_SECRET,
    );
  } catch {
    return reply(400);
  }
  const { error } = await checkoutDatabase()
    .from("operational_email_events")
    .upsert(
      {
        id: event.id,
        email_id: event.emailId,
        kind: event.type,
        occurred_at: event.occurredAt,
      },
      { onConflict: "id", ignoreDuplicates: true },
    );
  return reply(error ? 503 : 200);
}
