import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authClient } from "@/lib/supabase/auth-server";
import {
  browserCookie,
  checkoutRequestSchema,
  validBrowserToken,
  sha256,
  privateHash,
  resultPath,
  stripeCheckoutURL,
} from "@/lib/payments/checkout-core";
import {
  checkoutConfigured,
  checkoutDatabase,
  checkoutStripe,
  paymentHeaders,
  paymentOrigin,
} from "@/lib/payments/checkout-server";

const orderSchema = z.object({
  id: z.uuid(),
  status: z.string(),
  amount_total: z.number().int(),
  stripe_session_id: z.string().nullable(),
  checkout_url: z.string().nullable(),
  expires_at: z.string().nullable(),
  created_at: z.string(),
});
const itemSchema = z.object({
  stripe_price_id: z.string(),
  quantity: z.number().int(),
  unit_amount: z.number().int(),
  plan_id: z.string(),
});
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  const fail = (error: string, status: number) =>
    NextResponse.json({ error }, { status, headers: paymentHeaders });
  if (!checkoutConfigured()) return fail("payments_unavailable", 503);
  try {
    const origin = paymentOrigin();
    if (
      request.headers.get("origin") !== origin ||
      !request.headers.get("content-type")?.startsWith("application/json")
    )
      return fail("invalid_request", 403);
    const browser = request.cookies.get(browserCookie)?.value;
    if (!validBrowserToken(browser)) return fail("cookies_required", 409);
    if (Number(request.headers.get("content-length")) > 32768)
      return fail("invalid_request", 413);
    const text = await request.text();
    if (text.length > 32768) return fail("invalid_request", 413);
    let body;
    try {
      body = checkoutRequestSchema.parse(JSON.parse(text));
    } catch {
      return fail("invalid_request", 400);
    }
    const client = await authClient();
    const {
      data: { user },
      error: authError,
    } = await client.auth.getUser();
    // Missing sessions are valid for guests. Existing invalid/unavailable sessions must not silently become guest orders.
    if (authError && authError.name !== "AuthSessionMissingError")
      return fail("account_unavailable", 503);
    if (user && (!user.email_confirmed_at || !user.email))
      return fail("verify_email", 403);
    const email = user?.email ?? body.email.trim().toLowerCase();
    const secret = process.env.CHECKOUT_REQUEST_SECRET!;
    const fingerprint = sha256(
      JSON.stringify({
        email,
        user: user?.id ?? null,
        locale: body.locale,
        total: body.expectedTotal,
        lines: [...body.lines].sort((a, b) => a.planId.localeCompare(b.planId)),
      }),
    );
    const db = checkoutDatabase();
    const { data, error } = await db.rpc("create_test_checkout", {
      p_id: body.attemptId,
      p_user_id: user?.id ?? null,
      p_email: email,
      p_browser_hash: sha256(browser),
      p_ip_hash: privateHash(
        request.headers.get("x-vercel-forwarded-for") ??
          request.headers.get("x-forwarded-for") ??
          "local",
        secret,
      ),
      p_fingerprint: fingerprint,
      p_locale: body.locale,
      p_expected_total: body.expectedTotal,
      p_lines: body.lines,
    });
    if (error) {
      for (const [code, status] of [
        ["checkout_rate_limit", 429],
        ["price_changed", 409],
        ["unavailable_plan", 409],
        ["attempt_conflict", 409],
      ] as const)
        if (error.message.includes(code)) return fail(code, status);
      return fail("payments_unavailable", 503);
    }
    const order = orderSchema.parse(data);
    if (order.status === "paid")
      return NextResponse.json(
        { url: `${origin}${resultPath(body.locale, order.id)}` },
        { headers: paymentHeaders },
      );
    if (
      order.status !== "pending" ||
      (order.expires_at && new Date(order.expires_at).getTime() <= Date.now())
    )
      return fail("checkout_expired", 409);
    if (order.checkout_url)
      return NextResponse.json(
        { url: stripeCheckoutURL(order.checkout_url) },
        { headers: paymentHeaders },
      );
    if (new Date(order.created_at).getTime() < Date.now() - 25 * 60 * 1000)
      return fail("checkout_expired", 409);
    const { data: rawItems, error: itemsError } = await db
      .from("checkout_order_items")
      .select("stripe_price_id,quantity,unit_amount,plan_id")
      .eq("order_id", order.id)
      .order("plan_id");
    if (itemsError) throw new Error("Order unavailable");
    const items = z.array(itemSchema).min(1).max(20).parse(rawItems);
    const stripe = checkoutStripe();
    // Verify prices against Stripe itself, never trust amounts or Stripe IDs from a browser.
    for (const item of items) {
      const price = await stripe.prices.retrieve(item.stripe_price_id);
      if (
        price.livemode ||
        !price.active ||
        price.type !== "one_time" ||
        price.currency !== "usd" ||
        price.unit_amount !== item.unit_amount ||
        price.metadata.mts_plan_id !== item.plan_id
      )
        return fail("unavailable_plan", 409);
    }
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        allowed_payment_method_types: ["card"],
        locale: body.locale,
        adaptive_pricing: { enabled: false },
        branding_settings: {
          display_name: "MyTripSim",
          button_color: "#126de8",
          background_color: "#fcfdfe",
          border_style: "rounded",
        },
        client_reference_id: order.id,
        customer_email: email,
        line_items: items.map((item) => ({
          price: item.stripe_price_id,
          quantity: item.quantity,
        })),
        success_url: `${origin}${resultPath(body.locale, order.id)}`,
        cancel_url: `${origin}${resultPath(body.locale, order.id)}&cancelled=1`,
        metadata: { mts_order_id: order.id },
        payment_intent_data: { metadata: { mts_order_id: order.id } },
        expires_at:
          Math.floor(new Date(order.created_at).getTime() / 1000) + 3600,
        custom_text: {
          submit: {
            message:
              body.locale === "es"
                ? "Compra de prueba. No se emitirán eSIM ni se harán cargos reales."
                : "Test purchase. No real charges or eSIMs will be issued.",
          },
        },
      },
      { idempotencyKey: `mts_checkout_${order.id}` },
    );
    if (
      session.livemode ||
      session.amount_total !== order.amount_total ||
      session.currency !== "usd"
    )
      throw new Error("Session mismatch");
    const url = stripeCheckoutURL(session.url);
    const { error: updateError } = await db
      .from("checkout_orders")
      .update({
        stripe_session_id: session.id,
        checkout_url: url,
        expires_at: new Date(session.expires_at * 1000).toISOString(),
      })
      .eq("id", order.id)
      .eq("status", "pending");
    if (updateError) throw new Error("Session persistence failed");
    return NextResponse.json({ url }, { headers: paymentHeaders });
  } catch {
    return fail("payments_unavailable", 503);
  }
}
