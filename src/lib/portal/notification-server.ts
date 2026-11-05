import "server-only";

export type BusinessNotification = {
  id: string;
  order_id: string;
  trip_id: string;
  recipient_email: string;
  locale: "es" | "en";
  first_attempt_at: string;
  attempts: number;
  lease_token: string;
};
type ErrorCode = "transient" | "permanent" | "configuration" | "uncertain";
export type BusinessNotificationDependencies = {
  claim: () => Promise<BusinessNotification[]>;
  complete: (
    job: BusinessNotification,
    emailId: string | null,
    error: ErrorCode | null,
  ) => Promise<void>;
  send: (job: BusinessNotification) => Promise<string>;
};
class NotificationError extends Error {
  code: ErrorCode;
  constructor(code: ErrorCode) {
    super("Business notification unavailable");
    this.code = code;
  }
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A login-protected trip link only: no installation credentials or attachments. */
export function businessNotificationEmail(job: BusinessNotification) {
  if (
    !uuid.test(job.id) ||
    !uuid.test(job.trip_id) ||
    !["es", "en"].includes(job.locale) ||
    job.recipient_email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(job.recipient_email)
  )
    throw new NotificationError("permanent");
  const es = job.locale === "es";
  const link = `https://portal.mytripsim.com/${job.locale}/${es ? "viajes" : "trips"}/${job.trip_id}`;
  const subject = es
    ? "Las eSIM de tu viaje están listas"
    : "Your trip eSIMs are ready";
  const body = es
    ? "Las eSIM de tu pedido están listas en el portal de MyTripSim. Inicia sesión con tu cuenta de empresa para verlas y descargarlas."
    : "Your order's eSIMs are ready in the MyTripSim portal. Sign in with your business account to view and download them.";
  const action = es ? "Abrir mi viaje" : "Open my trip";
  return {
    subject,
    text: `${subject}\n\n${body}\n\n${action}: ${link}\n\nMyTripSim`,
    html: `<!doctype html><html lang="${job.locale}"><head><meta charset="utf-8"><title>${subject}</title></head><body style="font-family:Arial,sans-serif;color:#172033;background:#fff"><h1>${subject}</h1><p>${body}</p><p><a style="color:#1455bb" href="${link}">${action}</a></p><p>MyTripSim</p></body></html>`,
  };
}

export async function sendBusinessNotification(
  job: BusinessNotification,
  apiKey: string,
  fetcher: typeof fetch = fetch,
) {
  if (!apiKey.startsWith("re_")) throw new NotificationError("configuration");
  const mail = businessNotificationEmail(job);
  let response: Response;
  try {
    response = await fetcher("https://api.resend.com/emails", {
      method: "POST",
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `mts-b2b-ready-v1-${job.id}`,
      },
      body: JSON.stringify({
        from: "MyTripSim <esim@mytripsim.com>",
        to: [job.recipient_email],
        ...mail,
        tags: [{ name: "category", value: "business-order-ready" }],
      }),
    });
  } catch {
    throw new NotificationError("transient");
  }
  if (!response.ok)
    throw new NotificationError(
      response.status >= 500 || response.status === 429
        ? "transient"
        : "permanent",
    );
  try {
    const value = await response.json();
    if (typeof value?.id !== "string" || !uuid.test(value.id)) throw Error();
    return value.id as string;
  } catch {
    throw new NotificationError("transient");
  }
}

async function productionDependencies(): Promise<BusinessNotificationDependencies> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey?.startsWith("re_")) throw new NotificationError("configuration");
  const { checkoutDatabase } = await import("../payments/checkout-server");
  const db = checkoutDatabase();
  return {
    claim: async () => {
      const { data, error } = await db.rpc("claim_b2b_notifications", {
        p_limit: 2,
      });
      if (error || !Array.isArray(data))
        throw Error("Business notification queue unavailable");
      return data as BusinessNotification[];
    },
    complete: async (job, emailId, errorCode) => {
      const { data, error } = await db.rpc("complete_b2b_notification", {
        p_id: job.id,
        p_lease: job.lease_token,
        p_email_id: emailId,
        p_error: errorCode,
      });
      if (error || data !== true)
        throw Error("Business notification lease lost");
    },
    send: (job) => sendBusinessNotification(job, apiKey),
  };
}

/** Enqueued only by an admin RPC after all units are ready. The first attempt
 * timestamp never resets, including after lost responses or lease expiration.
 */
export async function runBusinessNotificationWorker(
  injected?: BusinessNotificationDependencies,
) {
  if (process.env.B2B_ISSUANCE_ENABLED !== "true")
    return { processed: 0, failed: 0, disabled: true };
  const deps = injected ?? (await productionDependencies());
  const jobs = await deps.claim();
  let failed = 0;
  for (const job of jobs) {
    try {
      const started = Date.parse(job.first_attempt_at);
      if (
        !Number.isFinite(started) ||
        started > Date.now() + 300000 ||
        Date.now() - started >= 23 * 3600000
      )
        throw new NotificationError("uncertain");
      const id = await deps.send(job);
      await deps.complete(job, id, null);
    } catch (error) {
      failed++;
      const code =
        error instanceof NotificationError ? error.code : "transient";
      // Lease expiry is safe: the same job/key retries only within 23 hours.
      await deps.complete(job, null, code).catch(() => {});
    }
  }
  return { processed: jobs.length, failed };
}
