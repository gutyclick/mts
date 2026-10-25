import { z } from "zod";
export const adminFilters = z.object({
  tab: z
    .enum(["summary", "users", "plans", "orders", "attention"])
    .default("summary"),
  q: z.string().trim().max(80).default(""),
  status: z
    .string()
    .max(40)
    .regex(/^[a-z_]*$/)
    .default(""),
  environment: z.enum(["all", "live", "test", "qa"]).default("all"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
  user: z.uuid().optional(),
});
export type AdminFilters = z.infer<typeof adminFilters>;
const number = z.coerce.number().nonnegative();
export const adminPlanSchema = z.object({
  id: z.uuid(),
  order_id: z.uuid(),
  user_id: z.uuid().nullable(),
  email: z.string().nullable(),
  recipient_email: z.string(),
  plan_name: z.string(),
  destination_name: z.object({ es: z.string(), en: z.string() }),
  data_gb: number,
  days: number,
  delivery_state: z.string(),
  status: z.string(),
  volume_bytes: number,
  used_bytes: number.nullable(),
  expires_at: z.string().nullable(),
  provider_checked_at: z.string().nullable(),
  provider_usage_updated_at: z.string().nullable(),
  livemode: z.boolean(),
  qa_authorized: z.boolean(),
  created_at: z.string(),
  note: z.string(),
  resolved: z.boolean(),
  attention: z.string().nullable(),
  can_sync: z.boolean(),
});
export type AdminPlan = z.infer<typeof adminPlanSchema>;
export const adminUserSchema = z.object({
  id: z.uuid(),
  email: z.string().nullable(),
  name: z.string(),
  created_at: z.string(),
  confirmed: z.boolean(),
  active_plans: number,
  issued_plans: number,
  paid_orders: number,
});
export type AdminUser = z.infer<typeof adminUserSchema>;
export const adminOrderSchema = z.object({
  id: z.uuid(),
  user_id: z.uuid().nullable(),
  email: z.string().nullable(),
  status: z.string(),
  amount_total: number,
  livemode: z.boolean(),
  created_at: z.string(),
  items: z.array(z.object({ name: z.string(), quantity: number })).nullable(),
});
export type AdminOrder = z.infer<typeof adminOrderSchema>;
export const overviewSchema = z.object({
  users: number,
  activePlans: number,
  readyPlans: number,
  attention: number,
  liveRevenueCents: number,
  testOrders: number,
  recentPlans: z.array(adminPlanSchema),
  activity: z.array(
    z.object({ action: z.string(), unit_id: z.uuid(), created_at: z.string() }),
  ),
  daily: z.array(z.object({ day: z.string(), orders: number })),
});
export type AdminOverview = z.infer<typeof overviewSchema>;
export const pageSchema = z.object({
  rows: z.array(z.unknown()),
  total: number,
  page: number,
  pageSize: number,
});
type Identity = {
  orderNo: string;
  esimId: string;
  iccid: string;
  volume: number;
};
type Profile = {
  orderNo: string;
  transactionId: string;
  iccid: string;
  status: string;
  smdpStatus: string;
  volumeBytes: number;
  usedBytes: number | null;
  expiresAt: string | null;
};
type Usage = {
  transactionId: string;
  usedBytes: number;
  totalBytes: number;
  updatedAt: string;
};
const validDate = (s: string | null) =>
  s && Number.isFinite(Date.parse(s)) ? new Date(s).toISOString() : null;
export function providerSnapshot(
  expected: Identity,
  p: Profile,
  usage: Usage | null,
) {
  if (
    p.orderNo !== expected.orderNo ||
    p.transactionId !== expected.esimId ||
    p.iccid !== expected.iccid ||
    p.volumeBytes !== expected.volume
  )
    throw new Error("Provider identity mismatch");
  if (
    usage &&
    (usage.transactionId !== expected.esimId ||
      usage.totalBytes !== expected.volume)
  )
    throw new Error("Usage identity mismatch");
  return {
    status: z.string().min(1).max(100).parse(p.status),
    smdp: z.string().max(100).parse(p.smdpStatus),
    used: usage?.usedBytes ?? p.usedBytes,
    expiry: validDate(p.expiresAt),
    usageAt: usage ? validDate(usage.updatedAt) : null,
  };
}
