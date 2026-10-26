import "server-only";
import { z } from "zod";
import { checkoutDatabase, paymentOrigin } from "../payments/checkout-server";
import { supportEmail } from "./email";
import { ticketReference } from "./model";
const jobSchema = z.object({
  id: z.uuid(),
  thread_id: z.uuid(),
  recipient: z.email(),
  locale: z.enum(["es", "en"]),
  kind: z.enum(["new_ticket", "customer_reply", "agent_reply"]),
  subject: z.string(),
  attempts: z.number(),
  lease_token: z.uuid(),
});
export async function runSupportNotifications() {
  const key = process.env.RESEND_API_KEY;
  if (!key?.startsWith("re_")) throw new Error("Mail unavailable");
  const db = checkoutDatabase(),
    { data, error } = await db.rpc("support_claim_notifications", {
      p_limit: 2,
    });
  if (error) throw new Error("Queue unavailable");
  let sent = 0,
    failed = 0;
  for (const row of z.array(jobSchema).parse(data)) {
    const customer = row.kind === "agent_reply",
      link = `${paymentOrigin()}/${row.locale}/${customer ? "support" : "admin/tickets"}?ticket=${row.thread_id}`;
    const email = supportEmail({
      locale: row.locale,
      reference: ticketReference(row.thread_id),
      subject: row.subject,
      link,
      customer,
    });
    let state = "pending",
      emailId: string | undefined,
      lastError: "temporary" | "permanent" | null = "temporary";
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        redirect: "error",
        cache: "no-store",
        signal: AbortSignal.timeout(15000),
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
          "Idempotency-Key": `mts-support-${row.id}`,
        },
        body: JSON.stringify({
          from: "MyTripSim <hello@mytripsim.com>",
          to: [row.recipient],
          reply_to: "hello@mytripsim.com",
          ...email,
        }),
      });
      if (response.ok) {
        const parsed = z
          .object({ id: z.string().min(1) })
          .parse(await response.json());
        emailId = parsed.id;
        state = "sent";
        lastError = null;
      } else if (
        response.status >= 400 &&
        response.status < 500 &&
        ![408, 409, 429].includes(response.status)
      ) {
        state = "failed";
        lastError = "permanent";
      }
    } catch {
      /* Retry with the same Resend idempotency key. No upstream data logged. */
    }
    const update = await db
      .from("support_notifications")
      .update({
        state,
        last_error: lastError,
        email_id: emailId,
        lease_token: null,
        lease_until: null,
        ...(state === "sent"
          ? { sent_at: new Date().toISOString() }
          : {
              next_attempt_at: new Date(
                Date.now() +
                  Math.min(3600000, 30000 * 2 ** Math.min(row.attempts, 7)),
              ).toISOString(),
            }),
      })
      .eq("id", row.id)
      .eq("lease_token", row.lease_token);
    if (update.error) throw new Error("Queue update unavailable");
    if (state === "sent") sent++;
    if (state === "failed") failed++;
  }
  return { sent, failed };
}
