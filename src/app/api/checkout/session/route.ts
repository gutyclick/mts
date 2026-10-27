import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authClient } from "@/lib/supabase/auth-server";
import { holdOrder, reconcileHold } from "@/lib/payments/hold-server";
import { queueCheckoutMeasurement } from "@/lib/analytics/server";
import { verifyHoldSession } from "@/lib/payments/hold-policy";
import {
  browserCookie,
  checkoutRequestSchema,
  validBrowserToken,
  sha256,
  privateHash,
  resultPath,
} from "@/lib/payments/checkout-core";
import {
  paymentMode,
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
  payment_total: z.number().int().nullable(),
  payment_currency: z.string().nullable(),
  livemode: z.boolean(),
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
  payment_unit_amount: z.number().int().nullable(),
  payment_stripe_price_id: z.string().nullable(),
});
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  let stage='request';
  const fail = (error: string, status: number) =>
    NextResponse.json({ error }, { status, headers: paymentHeaders });
  if (!checkoutConfigured()) return fail("payments_unavailable", 503);
  try {
    const origin = paymentOrigin();
    const live = paymentMode(process.env) === "live";
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
    const recipient = body.differentRecipient
      ? body.recipientEmail!.trim().toLowerCase()
      : email;
    const secret = process.env.CHECKOUT_REQUEST_SECRET!;
    const fingerprint = sha256(
      JSON.stringify({
        email,
        recipient,
        marketingOptIn: body.marketingOptIn,
        uiMode: "elements",
        livemode: live,
        walletVersion: "express-v1",
        holdPolicy: body.holdPolicy ?? null,
        user: user?.id ?? null,
        locale: body.locale,
        total: body.expectedTotal,
        currency: body.currency,
        fxQuoteId: body.fxQuoteId,
        paymentTotal: body.expectedPaymentTotal ?? body.expectedTotal,
        lines: [...body.lines].sort((a, b) => a.planId.localeCompare(b.planId)),
      }),
    );
    const db = checkoutDatabase();
    stage='create_order';
    const { data, error } = await db.rpc("create_checkout_v3", {
      p_livemode: live,
      p_id: body.attemptId,
      p_user_id: user?.id ?? null,
      p_billing_email: email,
      p_recipient_email: recipient,
      p_marketing_opt_in: body.marketingOptIn,
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
      console.error('checkout_preparation_failed',{stage,kind:error.code});return fail("payments_unavailable", 503);
    }
    stage='parse_order';let order = orderSchema.parse(data);
    if (order.livemode !== live) return fail("attempt_conflict", 409);
    // Record only a version explicitly accepted by this browser. Never backfill old orders.
    const { error: acceptanceError } = await db
      .from("checkout_legal_acceptances")
      .upsert(
        { order_id: order.id, version: body.legalVersion, locale: body.locale },
        { onConflict: "order_id,version", ignoreDuplicates: true },
      );
    if (acceptanceError) return fail("payments_unavailable", 503);
    if (
      data.payment_in_progress ||
      (data.payment_hold_expires_at &&
        new Date(data.payment_hold_expires_at).getTime() <= Date.now())
    ) {
      const reconciled = await reconcileHold((await holdOrder(order.id))!);
      if (reconciled.status === "paid" || reconciled.payment_in_progress)
        return NextResponse.json(
          { url: `${origin}${resultPath(body.locale, order.id)}` },
          { headers: paymentHeaders },
        );
      return fail("checkout_expired", 409);
    }
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
    stage='prepare_currency';const prepared = await db.rpc("prepare_checkout_payment", {
      p_id: order.id,
      p_currency: body.currency,
      p_quote: body.fxQuoteId,
      p_expected: body.expectedPaymentTotal ?? body.expectedTotal,
    });
    if (prepared.error) {
      for (const code of ["quote_expired", "price_changed", "attempt_conflict"])
        if (prepared.error.message.includes(code)) return fail(code, 409);
      console.error('checkout_preparation_failed',{stage,kind:prepared.error.code});return fail("payments_unavailable", 503);
    }
    order = orderSchema.parse(prepared.data);
    const stripe = checkoutStripe(live);
    if (order.stripe_session_id) {
      stage='existing_session';
      const existing = await stripe.checkout.sessions.retrieve(
        order.stripe_session_id,
      );
      verifyHoldSession(order, existing);
      if (
        existing.livemode !== live ||
        existing.ui_mode !== "elements" ||
        !existing.client_secret
      )
        return fail("checkout_expired", 409);
      if (body.holdPolicy)
        await db.rpc("touch_checkout_payment", {
          p_id: order.id,
          p_action: "active",
        });
      queueCheckoutMeasurement(request, order.id);
      return NextResponse.json(
        {
          clientSecret: existing.client_secret,
          orderId: order.id,
          paymentTotal: order.payment_total,
          paymentCurrency: order.payment_currency,
        },
        { headers: paymentHeaders },
      );
    }
    if (new Date(order.created_at).getTime() < Date.now() - 25 * 60 * 1000)
      return fail("checkout_expired", 409);
    stage='read_items';const { data: rawItems, error: itemsError } = await db
      .from("checkout_order_items")
      .select(
        "stripe_price_id,quantity,unit_amount,plan_id,payment_unit_amount,payment_stripe_price_id",
      )
      .eq("order_id", order.id)
      .order("plan_id");
    if (itemsError) throw new Error("Order unavailable");
    const items = z.array(itemSchema).min(1).max(20).parse(rawItems);
    const products = new Map<string, string>();
    stage='verify_base_prices';
    // Verify prices against Stripe itself, never trust amounts or Stripe IDs from a browser.
    for (const item of items) {
      const price = await stripe.prices.retrieve(item.stripe_price_id);
      if (
        price.livemode !== live ||
        !price.active ||
        price.type !== "one_time" ||
        price.currency !== "usd" ||
        price.unit_amount !== item.unit_amount ||
        price.metadata.mts_plan_id !== item.plan_id
      )
        return fail("unavailable_plan", 409);
      const product =
        typeof price.product === "string" ? price.product : price.product.id;
      if (!product || [...products.values()].includes(product))
        throw Error("Product identity mismatch");
      products.set(item.plan_id, product);
    }
    stage='create_session';const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        ui_mode: "elements",
        allowed_payment_method_types: ["card", "link"],
        locale: body.locale,
        adaptive_pricing: { enabled: false },
        client_reference_id: order.id,
        customer_email: email,
        line_items: items.map((item) =>
          order.payment_currency === "USD"
            ? { price: item.stripe_price_id, quantity: item.quantity }
            : {
                price_data: {
                  product: products.get(item.plan_id)!,
                  currency: order.payment_currency!.toLowerCase(),
                  unit_amount: item.payment_unit_amount!,
                },
                quantity: item.quantity,
              },
        ),
        return_url: `${origin}${resultPath(body.locale, order.id)}`,
        metadata: { mts_order_id: order.id },
        payment_intent_data: { metadata: { mts_order_id: order.id } },
        expires_at:
          Math.floor(new Date(order.created_at).getTime() / 1000) + 3600,
      },
      { idempotencyKey: `mts_elements_${order.id}` },
    );
    if (
      session.livemode !== live ||
      session.amount_total !== order.payment_total ||
      session.currency !== order.payment_currency?.toLowerCase()
    )
      throw new Error("Session mismatch");
    if (!session.client_secret || session.ui_mode !== "elements")
      throw new Error("Missing payment form");
    stage='bind_line_items';const lines = await stripe.checkout.sessions.listLineItems(session.id, {
      limit: 100,
    });
    if (lines.has_more || lines.data.length !== items.length)
      throw Error("Payment items mismatch");
    const bindings = items.map((item) => {
      const expectedProduct = products.get(item.plan_id)!;
      const matches = lines.data.filter((line) => {
        const product = line.price?.product;
        return (
          (typeof product === "string" ? product : product?.id) ===
          expectedProduct
        );
      });
      const line = matches[0];
      if (
        matches.length !== 1 ||
        !line.price ||
        line.quantity !== item.quantity ||
        line.price.currency !== order.payment_currency!.toLowerCase() ||
        line.price.unit_amount !== item.payment_unit_amount ||
        line.amount_total !== item.payment_unit_amount! * item.quantity
      )
        throw Error("Payment items mismatch");
      return {
        planId: item.plan_id,
        priceId: line.price.id,
        unitAmount: item.payment_unit_amount,
        quantity: item.quantity,
        productId: expectedProduct,
      };
    });
    stage='persist_session';const bound = await db.rpc("bind_checkout_payment", {
      p_id: order.id,
      p_session: session.id,
      p_bindings: bindings,
      p_expires: new Date(session.expires_at * 1000).toISOString(),
      p_touch: !!body.holdPolicy,
    });
    if (bound.error || bound.data !== true){console.error('checkout_preparation_failed',{stage,kind:bound.error?.code??'no_binding'});throw Error("Session persistence failed");}
    queueCheckoutMeasurement(request, order.id);
    return NextResponse.json(
      {
        clientSecret: session.client_secret,
        orderId: order.id,
        paymentTotal: order.payment_total,
        paymentCurrency: order.payment_currency,
      },
      { headers: paymentHeaders },
    );
  } catch(error) {
    console.error('checkout_preparation_failed',{stage,kind:error instanceof Error?error.name:'unknown'});
    return fail("payments_unavailable", 503);
  }
}
