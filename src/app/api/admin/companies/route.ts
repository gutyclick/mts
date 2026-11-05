import { NextRequest, NextResponse } from "next/server";
import { adminSession } from "@/lib/admin/server";
import {
  checkoutDatabase,
  paymentOrigin,
} from "@/lib/payments/checkout-server";
import { businessAdminAction, businessError } from "@/lib/portal/business";
import { businessBody, businessHeaders } from "@/lib/portal/server";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: businessHeaders });
async function authorize() {
  const session = await adminSession();
  return {
    session,
    denied: !session.user
      ? reply({ error: "unauthorized" }, 401)
      : session.needsMfa
        ? reply({ error: "mfa_required" }, 428)
        : !session.admin
          ? reply({ error: "forbidden" }, 403)
          : null,
  };
}
export async function GET() {
  try {
    const { session, denied } = await authorize();
    if (denied) return denied;
    const result = await checkoutDatabase().rpc("b2b_admin_records", {
      p_actor: session.user!.id,
    });
    return result.error
      ? reply({ error: "unavailable" }, 503)
      : reply(result.data);
  } catch {
    return reply({ error: "unavailable" }, 503);
  }
}
export async function POST(request: NextRequest) {
  if (
    process.env.NODE_ENV === "production" &&
    request.headers.get("origin") !== paymentOrigin()
  )
    return reply({ error: "forbidden" }, 403);
  try {
    const { session, denied } = await authorize();
    if (denied) return denied;
    const input = businessAdminAction.safeParse(await businessBody(request));
    if (!input.success) return reply({ error: "invalid" }, 400);
    const { action, ...value } = input.data;
    const result = await checkoutDatabase().rpc("b2b_admin_action", {
      p_actor: session.user!.id,
      p_action: action,
      p_value: value,
    });
    return result.error
      ? reply({ error: businessError(result.error) }, 409)
      : reply({ ok: true, id: result.data });
  } catch (error) {
    const code = error instanceof Error ? error.message : "unavailable";
    return reply(
      { error: ["forbidden", "invalid"].includes(code) ? code : "unavailable" },
      code === "forbidden" ? 403 : code === "invalid" ? 400 : 503,
    );
  }
}
