import { NextRequest, NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { authClient } from "@/lib/supabase/auth-server";
import { checkoutDatabase } from "@/lib/payments/checkout-server";
import { businessBody, businessHeaders } from "@/lib/portal/server";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: businessHeaders });
const schema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("login"),
      email: z.email().max(254),
      password: z.string().min(1).max(128),
    })
    .strict(),
  z
    .object({ action: z.literal("mfa"), code: z.string().regex(/^\d{6}$/) })
    .strict(),
  z.object({ action: z.literal("logout") }).strict(),
]);
export async function POST(request: NextRequest) {
  try {
    const parsed = schema.safeParse(await businessBody(request));
    if (!parsed.success) return reply({ error: "invalid" }, 400);
    const body = parsed.data;
    const client = await authClient();
    if (body.action === "logout") {
      const result = await client.auth.signOut({ scope: "local" });
      return result.error
        ? reply({ error: "unavailable" }, 503)
        : reply({ ok: true });
    }
    const secret = process.env.CHECKOUT_REQUEST_SECRET;
    if (!secret || secret.length < 32)
      return reply({ error: "unavailable" }, 503);
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      "unknown";
    const key = createHmac("sha256", secret)
      .update(`b2b-auth:${ip}`)
      .digest("hex");
    const rate = await checkoutDatabase().rpc("b2b_auth_rate", { p_hash: key });
    if (rate.error) return reply({ error: "unavailable" }, 503);
    if (!rate.data) return reply({ error: "rate_limited" }, 429);
    if (body.action === "login") {
      const result = await client.auth.signInWithPassword({
        email: body.email.trim(),
        password: body.password,
      });
      if (result.error || !result.data.user?.email_confirmed_at) {
        if (!result.error) await client.auth.signOut({ scope: "local" });
        return reply({ error: "login_failed" }, 401);
      }
      const hasFactor = result.data.user.factors?.some(
        (factor) => factor.status === "verified",
      );
      return reply({ ok: true, mfaRequired: !!hasFactor });
    }
    const {
      data: { user },
      error,
    } = await client.auth.getUser();
    if (error || !user?.email_confirmed_at)
      return reply({ error: "unauthorized" }, 401);
    const factor = user.factors?.find(
      (value) => value.status === "verified" && value.factor_type === "totp",
    );
    if (!factor) return reply({ error: "login_failed" }, 401);
    const result = await client.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: body.code,
    });
    return result.error
      ? reply({ error: "login_failed" }, 401)
      : reply({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : "unavailable";
    return reply(
      { error: ["forbidden", "invalid"].includes(code) ? code : "unavailable" },
      code === "forbidden" ? 403 : code === "invalid" ? 400 : 503,
    );
  }
}
