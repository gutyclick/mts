import "server-only";
import { z } from "zod";
import { checkoutDatabase } from "../payments/checkout-server";
import { esimAccess } from "../integrations/esimaccess-server";
import {
  alertEmail,
  operationalAlertSchema,
  canRetryNotification,
  operationsSnapshotSchema,
  notificationTimeout,
} from "./model";

const mailSchema = z.object({
  from: z.string().max(300),
  to: z.array(z.email()).length(1),
  reply_to: z.email(),
  subject: z.string().max(500),
  text: z.string().max(6000),
  html: z.string().max(12000),
});
const jobSchema = operationalAlertSchema.extend({
  lease_token: z.uuid(),
  attempts: z.number().int(),
  first_attempt_at: z.string().nullable(),
  notification_payload: mailSchema.nullable(),
});

export async function operationsSnapshot(actor: string) {
  const { data, error } = await checkoutDatabase().rpc("operations_snapshot", {
    p_actor: actor,
  });
  if (error) throw Error("Operations unavailable");
  const snapshot = operationsSnapshotSchema.parse(data);
  snapshot.settings.enabled =
    snapshot.settings.enabled && process.env.OPERATIONS_ENABLED === "true";
  return snapshot;
}

async function sendOperationalNotifications(deadline: number) {
  const db = checkoutDatabase(),
    key = process.env.RESEND_API_KEY;
  const { data: settings, error: settingsError } = await db
    .from("operations_settings")
    .select("recipient,enabled")
    .eq("id", true)
    .single();
  if (settingsError) throw Error("Settings unavailable");
  if (!settings.enabled) return { sent: 0, review: 0 };
  if (!key?.startsWith("re_")) throw Error("Mail unavailable");
  const recipient = z.email().parse(settings.recipient);
  const { data, error } = await db.rpc("operations_claim_notifications", {
    p_limit: 2,
  });
  if (error) throw Error("Queue unavailable");
  let sent = 0,
    review = 0;
  for (const job of z.array(jobSchema).parse(data)) {
    let state: "pending" | "sent" | "review" = "pending",
      emailId: string | null = null;
    try {
      if (
        !canRetryNotification({
          attempts: job.attempts,
          firstAttemptAt: job.first_attempt_at,
        })
      )
        throw Error("Retry window ended");
      let payload = job.notification_payload;
      if (!payload) {
        payload = {
          from: "MyTripSim Operaciones <hello@mytripsim.com>",
          to: [recipient],
          reply_to: "hello@mytripsim.com",
          ...alertEmail({
            id: job.id,
            kind: job.kind,
            reference: job.order_id?.slice(0, 8).toUpperCase() ?? null,
            balanceUnits: job.balance_units,
          }),
        };
        const frozen = await db
          .from("operational_alerts")
          .update({ notification_payload: payload })
          .eq("id", job.id)
          .eq("lease_token", job.lease_token)
          .is("notification_payload", null)
          .select("id");
        if (frozen.error || frozen.data?.length !== 1)
          throw Error("Lease lost");
      }
      // Persisted payload remains byte-for-byte stable across retries and recipient/template changes.
      const timeout = notificationTimeout(deadline);
      if (timeout === null) throw Error("Worker time budget ended");
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(timeout),
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `mts-operations-v1-${job.id}`,
        },
        body: JSON.stringify(payload),
      });
      if (response.ok) {
        emailId = z.object({ id: z.uuid() }).parse(await response.json()).id;
        state = "sent";
        sent++;
      } else if (
        response.status >= 400 &&
        response.status < 500 &&
        ![408, 429].includes(response.status)
      ) {
        state = "review";
        review++;
      }
    } catch {
      if (
        !canRetryNotification({
          attempts: job.attempts,
          firstAttemptAt: job.first_attempt_at,
        })
      ) {
        state = "review";
        review++;
      }
    }
    const result = await db
      .from("operational_alerts")
      .update({
        notification_state: state,
        ...(emailId
          ? { email_id: emailId, notified_at: new Date().toISOString() }
          : {}),
        lease_token: null,
        lease_until: null,
        next_attempt_at: new Date(
          Date.now() +
            Math.min(3600000, 60000 * 2 ** Math.min(job.attempts, 6)),
        ).toISOString(),
      })
      .eq("id", job.id)
      .eq("lease_token", job.lease_token);
    if (result.error) throw Error("Queue update unavailable");
  }
  return { sent, review };
}

export async function runOperationsWorker() {
  const deadline = Date.now() + 50000;
  if (process.env.OPERATIONS_ENABLED !== "true") return { disabled: true };
  const db = checkoutDatabase(),
    { data: token, error } = await db.rpc("operations_claim_run");
  if (error) throw Error("Operations unavailable");
  let detected = 0;
  if (token) {
    let balance: number | null = null,
      ok = false;
    try {
      balance = (await esimAccess().balance()).balanceUnits;
      ok = true;
    } catch {
      /* Unknown is not zero and must not clear an existing low-balance incident. */
    }
    const reconciled = await db.rpc("operations_reconcile", {
      p_token: token,
      p_balance: balance,
      p_ok: ok,
    });
    if (reconciled.error) throw Error("Operations unavailable");
    detected = reconciled.data;
  }
  return { detected, ...(await sendOperationalNotifications(deadline)) };
}
