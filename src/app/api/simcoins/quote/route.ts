import { NextRequest, NextResponse } from "next/server";
import { authClient } from "@/lib/supabase/auth-server";
import { paymentHeaders, paymentOrigin } from "@/lib/payments/checkout-server";
import { simcoinsQuoteRequestSchema } from "@/lib/simcoins/checkout";
import {
  createSimcoinsCheckoutQuote,
  simcoinsCheckoutEnabled,
} from "@/lib/simcoins/checkout-server";

export async function POST(request: NextRequest) {
  const response = (body: object, status = 200) =>
    NextResponse.json(body, { status, headers: paymentHeaders });
  if (!simcoinsCheckoutEnabled()) return response({ available: false });
  if (
    request.headers.get("origin") !== paymentOrigin() ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return response({ error: "invalid_request" }, 403);
  try {
    if (Number(request.headers.get("content-length")) > 32768)
      return response({ error: "invalid_request" }, 413);
    const text = await request.text();
    if (text.length > 32768) return response({ error: "invalid_request" }, 413);
    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      return response({ error: "invalid_request" }, 400);
    }
    const input = simcoinsQuoteRequestSchema.safeParse(raw);
    if (!input.success) return response({ error: "invalid_request" }, 400);
    const {
      data: { user },
      error,
    } = await (await authClient()).auth.getUser();
    if (error || !user?.email_confirmed_at)
      return response({ available: false });
    const quote = await createSimcoinsCheckoutQuote(user.id, input.data);
    return response(quote ? { available: true, quote } : { available: false });
  } catch {
    return response({ error: "simcoins_unavailable" }, 503);
  }
}
