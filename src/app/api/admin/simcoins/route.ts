import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { adminSession } from "@/lib/admin/server";
import {
  checkoutDatabase,
  paymentHeaders,
  paymentOrigin,
} from "@/lib/payments/checkout-server";
import { simcoinsFlags } from "@/lib/simcoins/config";

export const runtime = "nodejs";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: paymentHeaders });
const integer = (min: number, max: number) =>
  z.number().int().min(min).max(max);
const settingsSchema = z
  .object({
    enabled: z.boolean().optional(),
    earn_enabled: z.boolean().optional(),
    redeem_enabled: z.boolean().optional(),
    admin_enabled: z.boolean().optional(),
    public_enabled: z.boolean().optional(),
    release_delay_seconds: integer(0, 31536000).optional(),
    costs_max_age_seconds: integer(60, 604800).optional(),
    max_redeem_bps: integer(0, 500).optional(),
    min_contribution_bps: integer(2000, 10000).optional(),
    stripe_bps: integer(440, 10000).optional(),
    stripe_fx_bps: integer(540, 10000).optional(),
    fixed_fee_units: integer(3000, 99999999).optional(),
    affiliate_bps: integer(800, 10000).optional(),
    max_promotion_bps: integer(0, 500).optional(),
    other_variable_units: integer(0, 99999999).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0);
const common = {
  reason: z.string().trim().min(10).max(1000),
  request: z.uuid(),
};
const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("adjust"),
      user: z.uuid(),
      coins: integer(-99999999, 99999999).refine((value) => value !== 0),
      ...common,
    })
    .strict(),
  z
    .object({ action: z.literal("settings"), value: settingsSchema, ...common })
    .strict(),
  z
    .object({
      action: z.literal("level"),
      value: z
        .object({
          id: z.enum([
            "traveler",
            "explorer",
            "adventurer",
            "globetrotter",
            "legend",
          ]),
          name: z.string().trim().min(1).max(80),
          rate_bps: integer(0, 600),
          threshold_cents: integer(0, 100000000),
        })
        .strict()
        .refine(
          (value) =>
            value.id !== "traveler" ||
            (value.rate_bps === 0 && value.threshold_cents === 0),
        )
        .refine(
          (value) => value.id !== "explorer" || value.threshold_cents === 1,
        ),
      ...common,
    })
    .strict(),
  z
    .object({
      action: z.literal("product"),
      value: z
        .object({
          plan_id: z.string().trim().min(1).max(200),
          earn_enabled: z.boolean(),
          redeem_enabled: z.boolean(),
        })
        .strict(),
      ...common,
    })
    .strict(),
]);
async function session() {
  const s = await adminSession();
  const denied = !s.user
    ? reply({ error: "unauthorized" }, 401)
    : s.needsMfa
      ? reply({ error: "mfa_required" }, 428)
      : !s.admin
        ? reply({ error: "forbidden" }, 403)
        : null;
  return { s, denied };
}
export async function GET() {
  try {
    const { s, denied } = await session();
    if (denied) return denied;
    const flags = simcoinsFlags();
    if (!flags.adminEnabled || !flags.persistenceReady)
      return reply({ configured: false, enabled: false, snapshot: null });
    const result = await checkoutDatabase().rpc("simcoins_admin_snapshot", {
      p_actor: s.user!.id,
    });
    if (result.error || !result.data || typeof result.data !== "object")
      return reply({ error: "unavailable" }, 503);
    return reply({ configured: true, enabled: true, snapshot: result.data });
  } catch {
    return reply({ error: "unavailable" }, 503);
  }
}
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== paymentOrigin())
    return reply({ error: "forbidden" }, 403);
  try {
    const { s, denied } = await session();
    if (denied) return denied;
    const flags = simcoinsFlags();
    if (!flags.adminEnabled || !flags.persistenceReady)
      return reply({ error: "disabled" }, 409);
    if (
      !request.headers
        .get("content-type")
        ?.toLowerCase()
        .startsWith("application/json")
    )
      return reply({ error: "invalid" }, 415);
    if (Number(request.headers.get("content-length")) > 16384)
      return reply({ error: "invalid" }, 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 16384)
      return reply({ error: "invalid" }, 413);
    let input: unknown;
    try {
      input = JSON.parse(raw);
    } catch {
      return reply({ error: "invalid" }, 400);
    }
    const parsed = schema.safeParse(input);
    if (!parsed.success) return reply({ error: "invalid" }, 400);
    const body = parsed.data;
    const result =
      body.action === "adjust"
        ? await checkoutDatabase().rpc("simcoins_admin_adjust", {
            p_actor: s.user!.id,
            p_user: body.user,
            p_coins: body.coins,
            p_reason: body.reason,
            p_request: body.request,
          })
        : await checkoutDatabase().rpc("simcoins_admin_configure", {
            p_actor: s.user!.id,
            p_action: body.action,
            p_value: body.value,
            p_reason: body.reason,
            p_request: body.request,
          });
    if (result.error) return reply({ error: "conflict" }, 409);
    return reply({ ok: true });
  } catch {
    return reply({ error: "unavailable" }, 503);
  }
}
