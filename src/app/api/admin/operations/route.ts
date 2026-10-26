import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
export const maxDuration = 60;
import { adminSession } from "@/lib/admin/server";
import {
  checkoutDatabase,
  paymentHeaders,
  paymentOrigin,
} from "@/lib/payments/checkout-server";
import {
  operationsSnapshot,
  runOperationsWorker,
} from "@/lib/operations/server";
const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: paymentHeaders });
export async function GET() {
  try {
    const s = await adminSession();
    if (!s.user) return reply({ error: "unauthorized" }, 401);
    if (s.needsMfa) return reply({ error: "mfa_required" }, 428);
    if (!s.admin) return reply({ error: "forbidden" }, 403);
    return reply(await operationsSnapshot(s.user.id));
  } catch {
    return reply({ error: "unavailable" }, 503);
  }
}
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== paymentOrigin())
    return reply({ error: "forbidden" }, 403);
  try {
    const s = await adminSession();
    if (!s.user) return reply({ error: "unauthorized" }, 401);
    if (s.needsMfa) return reply({ error: "mfa_required" }, 428);
    if (!s.admin) return reply({ error: "forbidden" }, 403);
    if (Number(request.headers.get("content-length")) > 4096)
      return reply({ error: "invalid" }, 413);
    const raw = await request.text();
    if (raw.length > 4096) return reply({ error: "invalid" }, 413);
    let decoded: unknown;
    try {
      decoded = JSON.parse(raw);
    } catch {
      return reply({ error: "invalid" }, 400);
    }
    const body = z
      .discriminatedUnion("action", [
        z.object({ action: z.literal("acknowledge"), id: z.uuid() }).strict(),
        z.object({ action: z.literal("check") }).strict(),
      ])
      .safeParse(decoded);
    if (!body.success) return reply({ error: "invalid" }, 400);
    if (body.data.action === "check") {
      await runOperationsWorker();
      return reply({ ok: true });
    }
    const { data, error } = await checkoutDatabase().rpc(
      "operations_ack_alert",
      { p_actor: s.user.id, p_id: body.data.id },
    );
    if (error) return reply({ error: "unavailable" }, 503);
    return reply({ ok: data === true });
  } catch {
    return reply({ error: "unavailable" }, 503);
  }
}
