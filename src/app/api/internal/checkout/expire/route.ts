import { NextRequest, NextResponse } from "next/server";
import { sha256, sameHash, privateHash } from "@/lib/payments/checkout-core";
import { z } from "zod";
import {
  checkoutDatabase,
  paymentHeaders,
} from "@/lib/payments/checkout-server";
import { holdOrder, reconcileHold } from "@/lib/payments/hold-server";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const expected = process.env.CHECKOUT_EXPIRY_SECRET;
  const token =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  let authorized =
    !!expected &&
    token.length <= 256 &&
    sameHash(sha256(token), sha256(expected));
  if (!authorized && expected) {
    try {
      const signature =
        request.headers.get("x-checkout-expiry-signature") ?? "";
      const text = await request.text();
      if (text.length > 1024) throw new Error("Invalid job");
      const body = z
        .object({ issued: z.number().int(), nonce: z.uuid() })
        .strict()
        .parse(JSON.parse(text));
      const age = Date.now() / 1000 - body.issued;
      if (
        age < -5 ||
        age > 60 ||
        !sameHash(
          signature,
          privateHash(`${body.issued}.${body.nonce}`, expected),
        )
      )
        throw new Error("Invalid signature");
      const { data, error } = await checkoutDatabase().rpc(
        "consume_checkout_expiry_ticket",
        { p_id: body.nonce, p_issued: body.issued },
      );
      authorized = !error && data === true;
    } catch {}
  }
  if (!authorized)
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: paymentHeaders },
    );
  try {
    const db = checkoutDatabase();
    const { data, error } = await db.rpc("claim_checkout_expirations", {
      p_limit: 20,
    });
    if (error || !Array.isArray(data)) throw new Error("Worker unavailable");
    let next = 0,
      cancelled = 0,
      processing = 0,
      failed = 0;
    async function worker() {
      while (next < data.length) {
        const id = data[next++];
        try {
          const order = await holdOrder(id);
          if (!order) continue;
          const result = await reconcileHold(order);
          if (result.status === "cancelled") cancelled++;
          if (result.payment_in_progress) processing++;
        } catch {
          failed++;
          await db
            .from("checkout_orders")
            .update({ expiry_lease_until: null })
            .eq("id", id);
        }
      }
    }
    await Promise.all(Array.from({ length: Math.min(3, data.length) }, worker));
    return NextResponse.json(
      { processed: data.length, cancelled, processing, failed },
      { status: failed ? 503 : 200, headers: paymentHeaders },
    );
  } catch {
    return NextResponse.json(
      { error: "worker_unavailable" },
      { status: 503, headers: paymentHeaders },
    );
  }
}
