import "server-only";
import Stripe from "stripe";
import { z } from "zod";
import { checkoutDatabase, paymentEnvironment } from "./checkout-server";
import { dispatchRefund } from "./refund-execution";
import { refundView } from "./refund-model";
import { currencySchema } from "../currency-schema";
const jobSchema = z.object({
  id: z.uuid(),
  order_id: z.uuid(),
  amount: z.number().int().positive(),
  currency: currencySchema,
  livemode: z.boolean(),
  payment_intent: z.string(),
  stripe_refund_id: z.string().nullable(),
  first_attempt_at: z.string(),
  attempts: z.number().int(),
  lease_token: z.uuid(),
});
export function refundStripe(live: boolean) {
  const config = paymentEnvironment(process.env, live ? "live" : "test");
  if (live && process.env.VERCEL_ENV !== "production")
    throw Error("Live refunds require production");
  if (
    !new RegExp("^(sk|rk)_" + config.mode + "_[A-Za-z0-9]{16,}$").test(
      config.secret,
    )
  )
    throw Error("Refund service unavailable");
  return new Stripe(config.secret, { timeout: 8000, maxNetworkRetries: 0 });
}
export async function adminRefundView(actor: string, order: string | null) {
  const r = await checkoutDatabase().rpc("admin_refund_view", {
    p_actor: actor,
    p_order: order,
  });
  if (r.error) throw Error("Refund view unavailable");
  return refundView.parse(r.data);
}
export async function recordStripeRefund(
  refund: Stripe.Refund,
  live: boolean,
  checkedAt: string,
) {
  const id = refund.metadata?.mts_refund_request;
  if (!z.uuid().safeParse(id).success) return false;
  const intent =
    typeof refund.payment_intent === "string"
      ? refund.payment_intent
      : refund.payment_intent?.id;
  if (!intent || !refund.status) throw Error("Refund snapshot incomplete");
  const result = await checkoutDatabase().rpc("refund_record_stripe", {
    p_id: id,
    p_refund: refund.id,
    p_intent: intent,
    p_amount: refund.amount,
    p_currency: refund.currency,
    p_live: live,
    p_status: refund.status,
    p_checked_at: checkedAt,
  });
  if (result.error) throw Error("Refund reconciliation unavailable");
  return result.data === true;
}
export async function executeAdminRefund(actor: string, id: string) {
  const db = checkoutDatabase(),
    claim = await db.rpc("admin_refund_claim", { p_actor: actor, p_id: id });
  if (claim.error) throw Error("Refund claim unavailable");
  if (!claim.data) return { busy: true };
  const job = jobSchema.parse(claim.data);
  let creating = false;
  try {
    const stripe = refundStripe(job.livemode),
      checkedAt = new Date().toISOString();
    const [order, known] = await Promise.all([
      db
        .from("checkout_orders")
        .select(
          "amount_total,currency,payment_total,payment_currency,livemode,stripe_payment_intent,status",
        )
        .eq("id", job.order_id)
        .single(),
      db.from("refund_requests").select("id").eq("order_id", job.order_id),
    ]);
    if (order.error || known.error) throw Error("Order snapshot unavailable");
    if (
      job.currency.toLowerCase() !==
      (order.data.payment_currency ?? order.data.currency).toLowerCase()
    )
      throw Error("Refund currency mismatch");
    const payment = await stripe.paymentIntents.retrieve(job.payment_intent, {
      expand: ["latest_charge"],
    });
    const charge = payment.latest_charge;
    if (!charge || typeof charge === "string" || !charge.paid)
      throw Error("Captured payment unavailable");
    const refunds = await stripe.refunds.list({
      payment_intent: job.payment_intent,
      limit: 100,
    });
    const result = await dispatchRefund(
      {
        order: {
          amount: order.data.payment_total ?? order.data.amount_total,
          currency: (
            order.data.payment_currency ?? order.data.currency
          ).toLowerCase(),
          livemode: order.data.livemode,
          paymentIntent: order.data.stripe_payment_intent,
          status: order.data.status,
        },
        request: {
          id: job.id,
          amount: job.amount,
          firstAttemptAt: job.first_attempt_at,
          stripeRefundId: job.stripe_refund_id,
        },
        payment: {
          id: payment.id,
          amountReceived: payment.amount_received,
          currency: payment.currency,
          livemode: payment.livemode,
          status: payment.status,
          disputed: charge.disputed,
        },
        refunds: refunds.data.map((r) => ({
          id: r.id,
          amount: r.amount,
          currency: r.currency,
          status: r.status,
          paymentIntent:
            typeof r.payment_intent === "string"
              ? r.payment_intent
              : (r.payment_intent?.id ?? ""),
          requestId: r.metadata?.mts_refund_request ?? null,
        })),
        hasMore: refunds.has_more,
        knownRequestIds: known.data.map((r) => r.id),
      },
      job.order_id,
      job.attempts,
      {
        create: (payload, options) => {
          creating = true;
          return stripe.refunds.create(payload, options);
        },
        existing: (id) => refunds.data.find((r) => r.id === id),
      },
    );
    await recordStripeRefund(result, job.livemode, checkedAt);
    return { busy: false };
  } catch (error) {
    // Only an explicit rejection of this create request releases the hold. Network/unknown outcomes stay held.
    const definitive =
      creating &&
      error instanceof Stripe.errors.StripeInvalidRequestError &&
      error.code !== "idempotency_key_in_use";
    const issue = await db.rpc("admin_refund_issue", {
      p_actor: actor,
      p_id: job.id,
      p_lease: job.lease_token,
      p_definitive: definitive,
    });
    if (issue.error) throw Error("Refund outcome requires reconciliation");
    return { busy: false, review: !definitive };
  }
}
