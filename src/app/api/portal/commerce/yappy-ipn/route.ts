import { NextRequest, NextResponse } from "next/server";
import { verifyYappyIpn, yappyConfig } from "@/lib/integrations/yappy";
import { checkoutDatabase } from "@/lib/payments/checkout-server";
import {
  businessAttemptSchema,
  recordBusinessPayment,
} from "@/lib/portal/commerce-payments";
import { businessHeaders } from "@/lib/portal/server";
export const runtime = "nodejs";
export async function GET(request: NextRequest) {
  const reply = (status: number) =>
    NextResponse.json(
      { received: status === 200 },
      { status, headers: businessHeaders },
    );
  const p = request.nextUrl.searchParams;
  if (
    [...p.keys()].some(
      (k) => !["orderId", "status", "hash", "domain"].includes(k),
    ) ||
    ["orderId", "status", "hash", "domain"].some(
      (k) => p.getAll(k).length !== 1,
    )
  )
    return reply(400);
  const message = {
    orderId: p.get("orderId")!,
    status: p.get("status")!,
    hash: p.get("hash")!,
    domain: p.get("domain")!,
  };
  if (!/^[A-Za-z0-9]{1,15}$/.test(message.orderId)) return reply(400);
  try {
    const result = await checkoutDatabase()
      .from("b2b_payment_attempts")
      .select("*")
      .eq("provider_ref", message.orderId)
      .eq("method", "yappy")
      .single();
    if (result.error) return reply(400);
    const a = businessAttemptSchema.parse(result.data),
      config = yappyConfig(process.env, a.livemode);
    if (!config || !verifyYappyIpn(config, message)) return reply(400);
    const status =
      message.status === "E"
        ? "succeeded"
        : message.status === "R"
          ? "failed"
          : "cancelled";
    await recordBusinessPayment("settle", {
      id: a.id,
      provider_ref: a.provider_ref,
      amount_cents: a.expected_amount_cents,
      currency: "USD",
      livemode: a.livemode,
      status,
      event_id: `yappy:${message.orderId}:${message.status}`,
    });
    return reply(200);
  } catch {
    return reply(503);
  }
}
