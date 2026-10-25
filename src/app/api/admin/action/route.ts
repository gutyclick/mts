import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminSession, syncAdminPlan } from "@/lib/admin/server";
import {
  checkoutDatabase,
  paymentHeaders,
  paymentOrigin,
} from "@/lib/payments/checkout-server";
export const maxDuration = 60;
const input = z.discriminatedUnion("action", [
  z.object({ action: z.literal("sync"), id: z.uuid() }).strict(),
  z
    .object({
      action: z.literal("followup"),
      id: z.uuid(),
      note: z.string().trim().max(1000),
      resolved: z.boolean(),
    })
    .strict(),
]);
export async function POST(request: NextRequest) {
  const fail = (status: number) =>
    NextResponse.json(
      { error: "admin_action_failed" },
      { status, headers: paymentHeaders },
    );
  if (request.headers.get("origin") !== paymentOrigin()) return fail(403);
  if (Number(request.headers.get("content-length")) > 8192) return fail(413);
  try {
    const session = await adminSession();
    if (!session.user) return fail(401);
    if (!session.admin) return fail(403);
    const text = await request.text();
    if (text.length > 8192) return fail(413);
    const parsed = input.safeParse(JSON.parse(text));
    if (!parsed.success) return fail(400);
    const body = parsed.data;
    if (body.action === "sync")
      return (await syncAdminPlan(session.user.id, body.id))
        ? NextResponse.json({ ok: true }, { headers: paymentHeaders })
        : fail(429);
    const { data, error } = await checkoutDatabase().rpc(
      "admin_followup_save",
      {
        p_actor: session.user.id,
        p_unit: body.id,
        p_note: body.note,
        p_resolved: body.resolved,
      },
    );
    if (error || data !== true) throw new Error("Followup unavailable");
    return NextResponse.json({ ok: true }, { headers: paymentHeaders });
  } catch {
    return fail(503);
  }
}
