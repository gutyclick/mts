import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminSession } from "@/lib/admin/server";
import {
  checkoutDatabase,
  paymentHeaders,
  paymentOrigin,
} from "@/lib/payments/checkout-server";
import {
  adminRefundView,
  executeAdminRefund,
} from "@/lib/payments/refund-server";
export const runtime = "nodejs";
export const maxDuration = 60;
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: paymentHeaders });
async function session() {
  const s = await adminSession();
  return {
    s,
    denied: !s.user
      ? reply({ error: "unauthorized" }, 401)
      : s.needsMfa
        ? reply({ error: "mfa_required" }, 428)
        : !s.admin
          ? reply({ error: "forbidden" }, 403)
          : null,
  };
}
export async function GET(request: NextRequest) {
  try {
    const { s, denied } = await session();
    if (denied) return denied;
    const value = request.nextUrl.searchParams.get("order");
    if (value && !z.uuid().safeParse(value).success)
      return reply({ error: "invalid" }, 400);
    return reply(await adminRefundView(s.user!.id, value));
  } catch {
    return reply({ error: "unavailable" }, 503);
  }
}
const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("request"),
      order: z.uuid(),
      units: z.array(z.uuid()).min(1).max(200),
      reason: z.string().trim().min(10).max(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal("approve"),
      id: z.uuid(),
      ack: z.literal(true),
    })
    .strict(),
  z.object({ action: z.enum(["reject", "reconcile"]), id: z.uuid() }).strict(),
]);
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== paymentOrigin())
    return reply({ error: "forbidden" }, 403);
  try {
    const { s, denied } = await session();
    if (denied) return denied;
    if (Number(request.headers.get("content-length")) > 16384)
      return reply({ error: "invalid" }, 413);
    const raw = await request.text();
    if (raw.length > 16384) return reply({ error: "invalid" }, 413);
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return reply({ error: "invalid" }, 400);
    }
    const parsed = schema.safeParse(value);
    if (!parsed.success) return reply({ error: "invalid" }, 400);
    const body = parsed.data,
      actor = s.user!.id,
      db = checkoutDatabase();
    if (body.action === "request") {
      const r = await db.rpc("admin_refund_request", {
        p_actor: actor,
        p_order: body.order,
        p_units: body.units,
        p_reason: body.reason,
      });
      if (r.error) return reply({ error: "conflict" }, 409);
      return reply({ ok: true, id: r.data });
    }
    if (body.action === "reject") {
      const r = await db.rpc("admin_refund_reject", {
        p_actor: actor,
        p_id: body.id,
      });
      return r.error
        ? reply({ error: "conflict" }, 409)
        : reply({ ok: r.data === true });
    }
    if (body.action === "approve") {
      const r = await db.rpc("admin_refund_approve", {
        p_actor: actor,
        p_id: body.id,
        p_ack: body.ack,
      });
      if (r.error)
        return reply(
          {
            error: r.error.message.includes("fulfillment_busy")
              ? "fulfillment_busy"
              : "conflict",
          },
          409,
        );
    }
    return reply({ ok: true, ...(await executeAdminRefund(actor, body.id)) });
  } catch {
    return reply({ error: "unavailable" }, 503);
  }
}
