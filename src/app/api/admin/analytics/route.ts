import { NextRequest, NextResponse } from "next/server";
import { adminSession } from "@/lib/admin/server";
import {
  checkoutDatabase,
  paymentHeaders,
} from "@/lib/payments/checkout-server";
export async function GET(request: NextRequest) {
  const reply = (data: unknown, status = 200) =>
    NextResponse.json(data, { status, headers: paymentHeaders });
  try {
    const s = await adminSession();
    if (!s.user) return reply({ error: "unauthorized" }, 401);
    if (s.needsMfa) return reply({ error: "mfa_required" }, 428);
    if (!s.admin) return reply({ error: "forbidden" }, 403);
    const days = request.nextUrl.searchParams.get("days") ?? "30";
    if (!["1", "7", "30"].includes(days))
      return reply({ error: "invalid" }, 400);
    const { data, error } = await checkoutDatabase().rpc("admin_analytics", {
      p_actor: s.user.id,
      p_days: Number(days),
    });
    if (error) throw Error();
    return reply(data);
  } catch {
    return reply({ error: "unavailable" }, 503);
  }
}
