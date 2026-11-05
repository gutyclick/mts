import { z } from "zod";
import type { PortalTrip } from "./model.ts";

export const businessRole = z.enum(["owner", "coordinator", "finance"]);
export type BusinessRole = z.infer<typeof businessRole>;
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .regex(/^[^\u0000-\u001f\u007f]+$/u);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (value) =>
      Number.isFinite(Date.parse(value)) &&
      new Date(value).toISOString().slice(0, 10) === value,
  );
export const businessAction = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("apply"),
      name: text(120),
      website: z
        .union([
          z.literal(""),
          z
            .url()
            .max(300)
            .refine((value) => /^https?:\/\//.test(value)),
        ])
        .default(""),
      note: z.string().trim().max(1000).default(""),
    })
    .strict(),
  z.object({ action: z.literal("accept_invitation"), id: z.uuid() }).strict(),
  z
    .object({
      action: z.literal("invite"),
      companyId: z.uuid(),
      email: z.email().max(254),
      role: z.enum(["coordinator", "finance"]),
    })
    .strict(),
  z
    .object({
      action: z.literal("revoke_invitation"),
      companyId: z.uuid(),
      id: z.uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("remove_member"),
      companyId: z.uuid(),
      id: z.uuid(),
    })
    .strict(),
  z
    .object({
      action: z.literal("create_trip"),
      companyId: z.uuid(),
      id: z.uuid(),
      name: text(90),
      destination: text(100),
      departure: date,
      returning: date,
      travelers: z.number().int().min(1).max(10000),
      mode: z.enum(["individual", "package"]),
    })
    .strict()
    .refine((value) => value.returning >= value.departure),
  z
    .object({
      action: z.literal("request"),
      companyId: z.uuid(),
      tripId: z.uuid(),
      attemptId: z.uuid(),
      planId: text(200),
      quantity: z.number().int().min(1).max(10000),
      version: z.number().int().positive(),
    })
    .strict(),
]);
export const businessAdminAction = z.discriminatedUnion("action", [
  z
    .object({
      action: z.enum(["approve_application", "reject_application"]),
      id: z.uuid(),
      note: z.string().trim().max(1000).default(""),
    })
    .strict(),
  z
    .object({
      action: z.literal("company_status"),
      id: z.uuid(),
      status: z.enum(["active", "suspended"]),
      note: text(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal("review_request"),
      id: z.uuid(),
      version: z.number().int().positive(),
      decision: z.enum(["approved", "changes"]),
      note: z.string().trim().max(1000).default(""),
    })
    .strict()
    .refine((value) => value.decision !== "changes" || value.note.length >= 5),
]);
export const canManageTrips = (role: string | null | undefined) =>
  role === "owner" || role === "coordinator";
export const canManageMembers = (role: string | null | undefined) =>
  role === "owner";
export function businessOrigin(
  origin: string | null,
  host: string | null,
  production: boolean,
) {
  if (!origin || !host) return false;
  try {
    const value = new URL(origin);
    return (
      value.origin === origin &&
      value.host === host &&
      (production
        ? value.protocol === "https:" &&
          ["portal.mytripsim.com", "www.mytripsim.com"].includes(host)
        : value.protocol === "http:" &&
          ["localhost", "127.0.0.1"].includes(value.hostname))
    );
  } catch {
    return false;
  }
}
export const requestSchema = z.object({
  id: z.uuid(),
  plan_id: z.string(),
  plan_name: z.string(),
  data_gb: z.coerce.number().positive(),
  days: z.number().int().positive(),
  quantity: z.number().int().positive(),
  status: z.enum(["pending", "approved", "changes"]),
  version: z.number().int().positive(),
  review_note: z.string().nullable().optional(),
});
export const tripSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  destination_slug: z.string(),
  departure: z.string(),
  returning: z.string(),
  travelers: z.number().int().positive(),
  mode: z.enum(["individual", "package"]),
  version: z.number().int().positive(),
  request: requestSchema.nullable(),
});
export const workspaceSchema = z.object({
  restricted: z.boolean().default(false),
  company: z
    .object({ id: z.uuid(), name: z.string(), role: businessRole })
    .nullable(),
  companies: z.array(
    z.object({ id: z.uuid(), name: z.string(), role: businessRole }),
  ),
  trips: z.array(tripSchema),
  members: z.array(
    z.object({ user_id: z.uuid(), email: z.string(), role: businessRole }),
  ),
  invitations: z.array(
    z.object({
      id: z.uuid(),
      email: z.string(),
      role: businessRole,
      expires_at: z.string(),
      status: z.string(),
    }),
  ),
  incoming: z.array(
    z.object({
      id: z.uuid(),
      company_name: z.string(),
      role: businessRole,
      expires_at: z.string(),
    }),
  ),
  application: z
    .object({
      id: z.uuid(),
      name: z.string(),
      status: z.enum(["pending", "approved", "rejected"]),
      review_note: z.string().nullable(),
    })
    .nullable(),
});
export type BusinessWorkspace = z.infer<typeof workspaceSchema>;
export type BusinessSession = {
  user: { email: string };
  needsMfa: boolean;
  workspace: BusinessWorkspace;
};
export type BusinessSupport = { email: string; whatsapp: string } | null;
export type BusinessPlan = {
  id: string;
  name: string;
  data_gb: number;
  days: number;
};
export function toPortalTrip(
  value: z.infer<typeof tripSchema>,
  destination: string,
): PortalTrip {
  return {
    id: value.id,
    name: value.name,
    destination,
    destinationSlug: value.destination_slug,
    departure: value.departure,
    returning: value.returning,
    travelers: value.travelers,
    mode: value.mode,
    version: value.version,
    status: value.request?.status ?? "draft",
    assigned: 0,
    delivered: 0,
    activated: 0,
    sold: 0,
    ...(value.request
      ? {
          request: {
            id: value.request.id,
            quantity: value.request.quantity,
            plan: value.request.plan_id,
            planName: value.request.plan_name,
            days: value.request.days,
            dataGb: value.request.data_gb,
            version: value.request.version,
            reviewNote: value.request.review_note,
          },
        }
      : {}),
  };
}
export function businessError(value: unknown) {
  const message =
    typeof value === "object" && value !== null && "message" in value
      ? String(value.message)
      : String(value);
  return (
    [
      "company_required",
      "role_required",
      "mfa_required",
      "verified_account_required",
      "invalid_trip",
      "plan_unavailable",
      "plan_too_short",
      "invalid_quantity",
      "conflict",
      "invitation_unavailable",
      "rate_limited",
      "trip_limit",
      "invalid_state",
    ].find((code) => message === code) ?? "unavailable"
  );
}
