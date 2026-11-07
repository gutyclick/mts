import { after, NextRequest, NextResponse } from "next/server";
import { yappyConfig, verifyYappyIpn } from "@/lib/integrations/yappy";
import {
  checkoutDatabase,
  paymentHeaders,
} from "@/lib/payments/checkout-server";
import { runFulfillmentWorker } from "@/lib/fulfillment/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function GET(request: NextRequest) {
  const reply = (status: number) =>
    NextResponse.json(
      { received: status === 200 },
      { status, headers: paymentHeaders },
    );
  const p = request.nextUrl.searchParams;
  if (
    request.nextUrl.search.length > 4096 ||
    [...p.keys()].some(
      (k) => !["orderId", "status", "hash", "domain"].includes(k),
    ) ||
    ["orderId", "status", "hash", "domain"].some(
      (k) => p.getAll(k).length !== 1,
    )
  )
    return reply(400);
  const input = {
    orderId: p.get("orderId")!,
    status: p.get("status")!,
    hash: p.get("hash")!,
    domain: p.get("domain")!,
  };
  if (!/^[A-Za-z0-9]{15}$/.test(input.orderId)) return reply(400);
  try {
    const db = checkoutDatabase();
    const result = await db
      .from("checkout_yappy_attempts")
      .select("livemode,domain")
      .eq("provider_ref", input.orderId)
      .maybeSingle();
    if (
      result.error ||
      !result.data ||
      typeof result.data.livemode !== "boolean"
    )
      return reply(400);
    const config = yappyConfig(process.env, result.data.livemode, "retail");
    // Verification remains available when new payments are disabled, for late callbacks.
    if (
      !config ||
      input.domain !== result.data.domain ||
      !verifyYappyIpn(config, input)
    )
      return reply(400);
    const settled = await db.rpc("retail_yappy_settle", {
      p_ref: input.orderId,
      p_status: input.status,
      p_domain: input.domain,
      p_live: config.live,
    });
    if (settled.error) return reply(503);
    if (input.status === "E")
      after(async () => {
        try {
          await runFulfillmentWorker();
        } catch {
          /* The existing scheduler retries persisted delivery jobs. */
        }
      });
    return reply(200);
  } catch {
    return reply(503);
  }
}
