import { createHmac, timingSafeEqual } from "node:crypto";

export type FulfillmentJob = {
  id: string;
  order_id: string;
  plan_id: string;
  unit_index: number;
  state: string;
  attempts: number;
  provider_transaction_id: string;
  provider_order_no: string | null;
  provider_slug: string | null;
  volume_bytes: number;
  days: number;
  access_nonce: string;
  created_at: string;
  email_started_at: string | null;
};
export type AllocatedProfile = {
  transactionId: string;
  orderNo: string;
  iccid: string;
  smdpAddress: string | null;
  activationCode: string | null;
  status: string;
  smdpStatus: string;
  volumeBytes: number;
  usedBytes: number | null;
  expiresAt: string | null;
  packageSlug: string;
  days: number;
  apn: string | null;
};
export class FulfillmentError extends Error {
  readonly reason: string;
  constructor(reason: string) {
    super("Fulfillment requires review");
    this.reason = reason;
  }
}
export function deliveryToken(
  job: Pick<FulfillmentJob, "id" | "access_nonce">,
  secret: string,
) {
  if (secret.length < 32) throw new Error("Delivery not configured");
  return createHmac("sha256", secret)
    .update(`mts-delivery-v1:${job.id}:${job.access_nonce}`)
    .digest("hex");
}
export function validDeliveryToken(
  job: Pick<FulfillmentJob, "id" | "access_nonce">,
  token: string,
  secret: string,
) {
  return (
    /^[a-f0-9]{64}$/.test(token) &&
    timingSafeEqual(Buffer.from(token), Buffer.from(deliveryToken(job, secret)))
  );
}
type Dependencies = {
  enabled: boolean;
  order: () => Promise<{
    status: string;
    livemode: boolean;
    qaAuthorized?: boolean;
  }>;
  buy: (slug: string, transactionId: string) => Promise<string>;
  profiles: (orderNo: string) => Promise<AllocatedProfile[]>;
  publish: (profile: AllocatedProfile) => Promise<void>;
  send: () => Promise<string>;
  save: (patch: Record<string, unknown>) => Promise<void>;
};
export async function processFulfillment(
  job: FulfillmentJob,
  deps: Dependencies,
) {
  if (!deps.enabled) return;
  const order = await deps.order();
  if (order.status !== "paid" || (!order.livemode && !order.qaAuthorized))
    return;
  if (job.state === "queued") {
    if (!job.provider_slug) throw new FulfillmentError("unavailable_plan");
    const orderNo = await deps.buy(
      job.provider_slug,
      job.provider_transaction_id,
    );
    await deps.save({
      provider_order_no: orderNo,
      state: "provider_pending",
      attempts: 0,
    });
  } else if (job.state === "provider_pending") {
    if (!job.provider_order_no)
      throw new FulfillmentError("invalid_allocation");
    const profiles = await deps.profiles(job.provider_order_no);
    if (!profiles.length) {
      await deps.save({
        next_attempt_at: new Date(Date.now() + 30000).toISOString(),
      });
      return;
    }
    const p = profiles[0];
    if (
      profiles.length !== 1 ||
      p.orderNo !== job.provider_order_no ||
      p.packageSlug !== job.provider_slug ||
      p.volumeBytes !== job.volume_bytes ||
      p.days !== job.days ||
      !p.smdpAddress ||
      !p.activationCode ||
      !["GOT_RESOURCE", "IN_USE"].includes(p.status)
    )
      throw new FulfillmentError("invalid_allocation");
    await deps.publish(p);
  } else if (job.state === "ready") {
    if (
      job.email_started_at &&
      Date.now() - Date.parse(job.email_started_at) > 23 * 3600000
    )
      throw new FulfillmentError("email_uncertain");
    if (!job.email_started_at)
      await deps.save({ email_started_at: new Date().toISOString() });
    const id = await deps.send();
    await deps.save({
      state: "sent",
      email_id: id,
      attempts: 0,
      sent_at: new Date().toISOString(),
    });
  }
}
