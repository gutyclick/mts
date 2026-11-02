import { NextRequest, NextResponse } from "next/server";
import { adminSession } from "@/lib/admin/server";
import {
  checkoutDatabase,
  paymentHeaders,
  paymentOrigin,
} from "@/lib/payments/checkout-server";
import { couponAdminRequestSchema } from "@/lib/payments/coupons";

export const runtime = "nodejs";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: paymentHeaders });
async function authorize() {
  const session = await adminSession();
  const denied = !session.user
    ? reply({ error: "unauthorized" }, 401)
    : session.needsMfa
      ? reply({ error: "mfa_required" }, 428)
      : !session.admin
        ? reply({ error: "forbidden" }, 403)
        : null;
  return { session, denied };
}
export async function GET() {
  try {
    const { session, denied } = await authorize();
    if (denied) return denied;
    const { data, error } = await checkoutDatabase().rpc(
      "coupon_admin_snapshot",
      { p_actor: session.user!.id },
    );
    if (error || !data || !Array.isArray(data.coupons))
      return reply({ error: "unavailable" }, 503);
    return reply(data);
  } catch {
    return reply({ error: "unavailable" }, 503);
  }
}
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== paymentOrigin())
    return reply({ error: "forbidden" }, 403);
  try {
    const { session, denied } = await authorize();
    if (denied) return denied;
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return reply({ error: "invalid" }, 415);
    if (Number(request.headers.get("content-length")) > 16384)
      return reply({ error: "invalid" }, 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 16384)
      return reply({ error: "invalid" }, 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply({ error: "invalid" }, 400);
    }
    const input = couponAdminRequestSchema.safeParse(body);
    if (!input.success) return reply({ error: "invalid" }, 400);
    const result = await checkoutDatabase().rpc("coupon_admin_save", {
      p_actor: session.user!.id,
      p_value: input.data.value,
      p_action: input.data.action,
      p_request: input.data.request,
    });
    if (result.error) return reply({ error: "conflict" }, 409);
    return reply({ ok: true });
  } catch {
    return reply({ error: "unavailable" }, 503);
  }
}
