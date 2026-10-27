import { NextRequest, NextResponse } from "next/server";
import { sameHash, sha256 } from "@/lib/payments/checkout-core";
import {
  checkoutDatabase,
  paymentHeaders,
} from "@/lib/payments/checkout-server";
import { simcoinsFlags } from "@/lib/simcoins/config";

export const runtime = "nodejs";
export const maxDuration = 60;

// Dedicated scheduler secret. Repeated runs are safe: release postings have unique source keys.
export async function POST(request: NextRequest) {
  const respond = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: paymentHeaders });
  const expected = process.env.SIMCOINS_WORKER_SECRET;
  const token =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (
    !expected ||
    expected.length < 32 ||
    token.length > 256 ||
    !sameHash(sha256(token), sha256(expected))
  )
    return respond({ error: "unauthorized" }, 401);
  if (!simcoinsFlags().persistenceReady)
    return respond({ enabled: false, released: 0 });
  try {
    const result = await checkoutDatabase().rpc("simcoins_release_due", {
      p_limit: 100,
    });
    if (result.error) throw Error("release_failed");
    return respond({ released: result.data });
  } catch {
    return respond({ error: "simcoins_worker_unavailable" }, 503);
  }
}
