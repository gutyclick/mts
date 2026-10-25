import "server-only";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { privateHash, sameHash, sha256 } from "./checkout-core";
import { checkoutDatabase } from "./checkout-server";
export async function workerAuthorized(request: NextRequest) {
  const expected = process.env.CHECKOUT_EXPIRY_SECRET;
  const token =
    request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!expected) return false;
  if (token.length <= 256 && sameHash(sha256(token), sha256(expected)))
    return true;
  try {
    if (Number(request.headers.get("content-length")) > 1024) return false;
    const text = await request.text();
    if (text.length > 1024) return false;
    const body = z
      .object({ issued: z.number().int(), nonce: z.uuid() })
      .strict()
      .parse(JSON.parse(text));
    const age = Date.now() / 1000 - body.issued;
    if (
      age < -5 ||
      age > 60 ||
      !sameHash(
        request.headers.get("x-checkout-expiry-signature") ?? "",
        privateHash(`${body.issued}.${body.nonce}`, expected),
      )
    )
      return false;
    const { data, error } = await checkoutDatabase().rpc(
      "consume_checkout_expiry_ticket",
      { p_id: body.nonce, p_issued: body.issued },
    );
    return !error && data === true;
  } catch {
    return false;
  }
}
