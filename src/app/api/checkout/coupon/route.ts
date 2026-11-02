import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authClient } from "@/lib/supabase/auth-server";
import {
  checkoutDatabase,
  checkoutConfigured,
  paymentHeaders,
  paymentOrigin,
} from "@/lib/payments/checkout-server";
import {
  browserCookie,
  validBrowserToken,
  privateHash,
} from "@/lib/payments/checkout-core";
import {
  couponQuoteRequestSchema,
  couponQuoteSchema,
  couponFailure,
} from "@/lib/payments/coupons";
import {
  refreshPromotionCosts,
  promotionCostSchema,
} from "@/lib/payments/promotion-costs";

export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const reply = (body: unknown, status = 200) =>
    NextResponse.json(body, { status, headers: paymentHeaders });
  if (!checkoutConfigured()) return reply({ error: "coupon_unavailable" }, 503);
  if (
    request.headers.get("origin") !== paymentOrigin() ||
    !request.headers.get("content-type")?.startsWith("application/json")
  )
    return reply({ error: "invalid_request" }, 403);
  const browser = request.cookies.get(browserCookie)?.value;
  if (!validBrowserToken(browser))
    return reply({ error: "invalid_request" }, 403);
  try {
    if (Number(request.headers.get("content-length")) > 16384)
      return reply({ error: "invalid_request" }, 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 16384)
      return reply({ error: "invalid_request" }, 413);
    let input;
    try {
      input = couponQuoteRequestSchema.safeParse(JSON.parse(raw));
    } catch {
      return reply({ error: "invalid_request" }, 400);
    }
    if (!input.success) return reply({ error: "invalid_request" }, 400);
    const {
      data: { user },
      error: authError,
    } = await (await authClient()).auth.getUser();
    if (authError && authError.name !== "AuthSessionMissingError")
      return reply({ error: "coupon_unavailable" }, 503);
    if (user && (!user.email_confirmed_at || !user.email))
      return reply({ error: "invalid_request" }, 403);
    const secret = process.env.CHECKOUT_REQUEST_SECRET!;
    const email = (user?.email ?? input.data.email).trim().toLowerCase();
    const db = checkoutDatabase();
    const args = {
      p_code: input.data.code,
      p_identity: privateHash(email, secret),
      p_user: user?.id ?? null,
      p_lines: input.data.lines,
      p_currency: input.data.currency,
      p_fx_quote: input.data.fxQuoteId,
      p_rate_key: privateHash(
        (
          request.headers.get("x-vercel-forwarded-for") ??
          request.headers.get("x-forwarded-for") ??
          "local"
        )
          .split(",")[0]
          .trim(),
        secret,
      ),
    };
    let result = await db.rpc("coupon_create_quote", args);
    if (!result.error && result.data?.error === "coupon_cost_unavailable") {
      const ids = input.data.lines.map((line) => line.planId);
      const [plans, costs, policy] = await Promise.all([
        db
          .from("catalog_plans")
          .select("id,allowance,days,coverage_code")
          .in("id", ids)
          .eq("is_published", true),
        db
          .from("simcoins_private_costs")
          .select("plan_id,wholesale_unit_units,observed_at")
          .in("plan_id", ids),
        db
          .from("simcoins_program_settings")
          .select("costs_max_age_seconds")
          .eq("id", true)
          .single(),
      ]);
      if (!plans.error && !costs.error && !policy.error) {
        const safePlans = z
          .array(
            z.object({
              id: z.string(),
              allowance: z.string(),
              days: z.number().int(),
              coverage_code: z.string(),
            }),
          )
          .parse(plans.data);
        await refreshPromotionCosts(
          safePlans,
          z.array(promotionCostSchema).parse(costs.data),
          z
            .number()
            .int()
            .min(60)
            .max(604800)
            .parse(policy.data.costs_max_age_seconds),
        );
        result = await db.rpc("coupon_create_quote", args);
      }
    }
    if (result.error)
      return reply({ error: couponFailure(result.error.message) }, 409);
    if (!result.data || result.data.error)
      return reply(
        {
          error: couponFailure(String(result.data?.error ?? "invalid_coupon")),
        },
        409,
      );
    return reply({ quote: couponQuoteSchema.parse(result.data) });
  } catch {
    return reply({ error: "coupon_unavailable" }, 503);
  }
}
