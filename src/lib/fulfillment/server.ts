import "server-only";
import QRCode from "qrcode";
import { z } from "zod";
import { checkoutDatabase } from "../payments/checkout-server";
import { esimAccess } from "../integrations/esimaccess-server";
import { EsimAccessError } from "../integrations/esimaccess-api";
import {
  processFulfillment,
  FulfillmentError,
  deliveryToken,
  type FulfillmentJob,
} from "./core";
import { deliveryEmail } from "./email";

export async function fulfillmentUnits(orderId: string) {
  const { data, error } = await checkoutDatabase()
    .from("esim_fulfillments")
    .select("*")
    .eq("order_id", orderId)
    .order("plan_id")
    .order("unit_index");
  if (error) throw new Error("Delivery unavailable");
  return data ?? [];
}
export async function publicUnit(
  row: Record<string, unknown>,
  details = false,
) {
  const unit = {
    id: row.id,
    planId: row.plan_id,
    unitIndex: row.unit_index,
    state: row.state,
  };
  if (!details || !["ready", "sent"].includes(String(row.state))) return unit;
  const smdp = z
      .string()
      .regex(/^[a-zA-Z0-9.-]+$/)
      .parse(row.smdp_address),
    code = z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .parse(row.activation_code);
  return {
    ...unit,
    smdpAddress: smdp,
    activationCode: code,
    iccid: row.iccid,
    apn: row.apn,
    qr: await QRCode.toDataURL(`LPA:1$${smdp}$${code}`, {
      width: 256,
      margin: 2,
      errorCorrectionLevel: "M",
    }),
  };
}
async function sendDelivery(
  row: FulfillmentJob & Record<string, unknown>,
  order: Record<string, unknown>,
) {
  const apiKey = process.env.RESEND_API_KEY,
    linkSecret = process.env.FULFILLMENT_LINK_SECRET;
  if (!apiKey?.startsWith("re_") || !linkSecret || linkSecret.length < 32)
    throw new FulfillmentError("configuration");
  const db = checkoutDatabase();
  const { data: line, error } = await db
    .from("checkout_order_items")
    .select("plan_name,data_gb,days")
    .eq("order_id", row.order_id)
    .eq("plan_id", row.plan_id)
    .single();
  if (error || !line) throw new Error("Delivery unavailable");
  const locale = z.enum(["es", "en"]).parse(order.locale);
  const recipient = z.email().parse(order.recipient_email);
  const smdp = z
      .string()
      .regex(/^[a-zA-Z0-9.-]+$/)
      .parse(row.smdp_address),
    code = z
      .string()
      .regex(/^[a-zA-Z0-9_-]+$/)
      .parse(row.activation_code);
  const qr = await QRCode.toBuffer(`LPA:1$${smdp}$${code}`, {
    width: 320,
    margin: 2,
    errorCorrectionLevel: "M",
  });
  const token = deliveryToken(row, linkSecret);
  const link = `https://www.mytripsim.com/${locale}/esim/access#${row.id}.${token}`;
  const mail = deliveryEmail({
    locale,
    name: line.plan_name,
    dataGb: Number(line.data_gb),
    days: line.days,
    reference: row.order_id.slice(0, 8).toUpperCase(),
    smdpAddress: smdp,
    activationCode: code,
    link,
    qrContentId: "esim-qr",
  });
  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `mts-esim-delivery-v1-${row.id}`,
      },
      body: JSON.stringify({
        from: "MyTripSim <esim@mytripsim.com>",
        to: [recipient],
        ...mail,
        attachments: [
          {
            filename: `MyTripSim-${row.id.slice(0, 8)}.png`,
            content: qr.toString("base64"),
            content_type: "image/png",
            content_id: "esim-qr",
          },
        ],
        tags: [{ name: "category", value: "esim-delivery" }],
      }),
    });
  } catch {
    throw new Error("Email unavailable");
  }
  if (!response.ok) {
    if (response.status < 500 && response.status !== 429)
      throw new FulfillmentError("email_unavailable");
    throw new Error("Email unavailable");
  }
  return z.object({ id: z.uuid() }).parse(await response.json()).id;
}
export async function runFulfillmentWorker() {
  if (process.env.FULFILLMENT_ENABLED !== "true")
    return { processed: 0, failed: 0, disabled: true };
  const db = checkoutDatabase();
  const { data: jobs, error } = await db.rpc("claim_esim_fulfillments", {
    p_limit: 2,
  });
  if (error || !Array.isArray(jobs)) throw new Error("Queue unavailable");
  let failed = 0;
  await Promise.all(
    jobs.map(async (row) => {
      const job = row as FulfillmentJob & Record<string, unknown>;
      let order: Record<string, unknown>;
      const save = async (patch: Record<string, unknown>) => {
        const { data, error } = await db
          .from("esim_fulfillments")
          .update({ ...patch, updated_at: new Date().toISOString() })
          .eq("id", job.id)
          .eq("lease_token", row.lease_token)
          .gt("lease_until", new Date().toISOString())
          .select("id");
        if (error || !data?.length) throw new Error("Lease lost");
        Object.assign(job, patch);
      };
      try {
        await processFulfillment(job, {
          enabled: true,
          order: async () => {
            const { data, error } = await db
              .from("checkout_orders")
              .select("status,livemode,locale,recipient_email")
              .eq("id", job.order_id)
              .single();
            if (error || !data) throw new Error("Order unavailable");
            order = data;
            return { ...data, qaAuthorized: row.qa_authorized === true };
          },
          buy: (slug, id) => esimAccess().purchaseProfile(slug, id),
          profiles: (id) => esimAccess().allocatedProfile(id),
          publish: async (profile) => {
            const { data, error } = await db.rpc("publish_esim_profile", {
              p_id: job.id,
              p_lease: row.lease_token,
              p_profile: profile,
            });
            if (error || data !== true)
              throw new Error("Publication unavailable");
          },
          send: () => sendDelivery(job, order),
          save,
        });
        await db
          .from("esim_fulfillments")
          .update({
            lease_token: null,
            lease_until: null,
            last_error: null,
            next_attempt_at: new Date(Date.now() + 15000).toISOString(),
          })
          .eq("id", job.id)
          .eq("lease_token", row.lease_token);
      } catch (error) {
        failed++;
        const reason =
          error instanceof FulfillmentError
            ? error.reason
            : error instanceof EsimAccessError &&
                ["configuration", "response"].includes(error.kind)
              ? "configuration"
              : job.state === "ready"
                ? "email_unavailable"
                : "provider_unavailable";
        const permanent =
          error instanceof FulfillmentError ||
          (error instanceof EsimAccessError &&
            (error.kind === "configuration" ||
              (error.kind === "response" && job.state !== "queued")));
        await db
          .from("esim_fulfillments")
          .update({
            state: permanent || job.attempts >= 24 ? "review" : job.state,
            last_error: reason,
            lease_token: null,
            lease_until: null,
            next_attempt_at: new Date(
              Date.now() +
                Math.min(3600000, 30000 * 2 ** Math.min(job.attempts, 7)),
            ).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id)
          .eq("lease_token", row.lease_token);
      }
    }),
  );
  return { processed: jobs.length, failed };
}
