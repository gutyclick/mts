import { z } from "zod";
import { Webhook } from "svix";

export const deliveryKinds = [
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.failed",
  "email.suppressed",
] as const;
export function parseDeliveryEvent(
  raw: string,
  headers: Record<string, string>,
  secret: string,
) {
  new Webhook(secret).verify(raw, headers);
  const verified: unknown = JSON.parse(raw);
  const parsed = z
    .object({
      type: z.enum(deliveryKinds),
      created_at: z.iso.datetime({ offset: true }),
      data: z.object({ email_id: z.uuid() }),
    })
    .parse(verified);
  return {
    id: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .parse(headers["svix-id"]),
    emailId: parsed.data.email_id,
    type: parsed.type,
    occurredAt: parsed.created_at,
  };
}
export const alertKinds = [
  "paid_without_delivery",
  "email_bounced",
  "email_failed",
  "email_complained",
  "email_delayed",
  "provider_low_balance",
  "provider_check_failed",
] as const;
export const alertNames = {
  paid_without_delivery: "Pedido pagado pendiente de entrega",
  email_bounced: "El correo de entrega ha rebotado",
  email_failed: "El correo de entrega no se pudo enviar",
  email_complained: "El destinatario ha marcado el correo como no deseado",
  email_delayed: "La entrega del correo se está retrasando",
  provider_low_balance: "Saldo bajo en eSIM Access",
  provider_check_failed: "No se pudo comprobar el saldo del proveedor",
};
export const operationalAlertSchema = z.object({
  id: z.uuid(),
  kind: z.enum(alertKinds),
  order_id: z.uuid().nullable(),
  unit_id: z.uuid().nullable(),
  state: z.enum(["open", "acknowledged", "resolved"]),
  opened_at: z.string(),
  last_seen_at: z.string(),
  resolved_at: z.string().nullable(),
  notified_at: z.string().nullable(),
  notification_state: z.enum(["pending", "sent", "review"]),
  balance_units: z.coerce.number().nullable(),
});
export type OperationalAlert = z.infer<typeof operationalAlertSchema>;
export const operationsSnapshotSchema = z.object({
  settings: z.object({
    enabled: z.boolean(),
    recipient: z.email(),
    thresholdUnits: z.coerce.number(),
    balanceUnits: z.coerce.number().nullable(),
    balanceOk: z.boolean(),
    lastBalanceAt: z.string().nullable(),
    lastRunAt: z.string().nullable(),
  }),
  alerts: z.array(operationalAlertSchema),
});
export type OperationsSnapshot = z.infer<typeof operationsSnapshotSchema>;
export function notificationTimeout(deadline: number, now = Date.now()) {
  const remaining = deadline - now - 3000;
  return remaining >= 1000 ? Math.min(15000, remaining) : null;
}
export function canRetryNotification(
  job: { attempts: number; firstAttemptAt: string | null },
  now = Date.now(),
) {
  return (
    job.attempts <= 8 &&
    (!job.firstAttemptAt || now - Date.parse(job.firstAttemptAt) < 23 * 3600000)
  );
}
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function alertEmail(input: {
  id: string;
  kind: (typeof alertKinds)[number];
  reference: string | null;
  balanceUnits: number | null;
}) {
  const title = alertNames[input.kind],
    link = `https://www.mytripsim.com/es/admin/operations?alert=${encodeURIComponent(input.id)}`;
  const details = [
    input.reference ? `Pedido #${input.reference}` : "",
    input.balanceUnits !== null
      ? `Saldo consultado: USD ${(input.balanceUnits / 10000).toFixed(2)}`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    subject: `MyTripSim · ${title}`,
    text: `${title}\n${details}\n\nRevisa la incidencia en la administración: ${link}\nEsta alerta no cancela pedidos, no emite otra eSIM y no realiza reembolsos.`,
    html: `<!doctype html><html lang="es"><body style="margin:0;background:#f3f7ff;font-family:Arial,sans-serif;color:#14223a"><div style="max-width:560px;margin:24px auto;padding:28px;background:#fff;border:1px solid #dbe7f6;border-radius:20px"><p style="color:#1269ed;font-weight:bold">MyTripSim · Operaciones</p><h1 style="font-size:24px">${escape(title)}</h1><p>${escape(details)}</p><p><a href="${escape(link)}" style="display:inline-block;background:#1269ed;color:#fff;padding:14px 20px;border-radius:12px;text-decoration:none">Revisar incidencia</a></p><p style="font-size:12px;line-height:1.6;color:#526785">Esta alerta no cancela pedidos, no emite otra eSIM y no realiza reembolsos.</p></div></body></html>`,
  };
}
