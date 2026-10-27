import "server-only";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authClient } from "./supabase/auth-server";
import { authPath, safeAccountNext } from "./auth-routes";
import type { Locale } from "./i18n";
import { checkoutDatabase } from "./payments/checkout-server";

const orderSchema = z.object({
  id: z.uuid(),
  status: z.enum([
    "pending",
    "processing",
    "completed",
    "cancelled",
    "refunded",
  ]),
  created_at: z.string(),
  destination_name: z.object({ es: z.string(), en: z.string() }),
  plan_name: z.string(),
  data_gb: z.coerce.number().positive(),
  days: z.number().int().positive(),
  checkout_order_id: z.uuid().nullable().optional(),
});
const esimSchema = z.object({
  id: z.uuid(),
  order_id: z.uuid(),
  status: z.enum(["ready", "active", "expired", "suspended"]),
  used_gb: z.coerce.number().nonnegative().nullable(),
  usage_updated_at: z.string().nullable(),
  expires_at: z.string().nullable(),
});
const privateSchema = esimSchema.extend({
  iccid: z.string().nullable(),
  smdp_address: z.string().nullable(),
  activation_code: z.string().nullable(),
});
export type CustomerOrder = z.infer<typeof orderSchema>;
export type CustomerEsim = z.infer<typeof esimSchema>;
export type PrivateEsim = z.infer<typeof privateSchema>;

export async function customerCheckoutOrders(
  client: Awaited<ReturnType<typeof authClient>>,
  userId: string,
) {
  const { data, error } = await client
    .from("checkout_orders")
    .select(
      "id,status,amount_total,payment_total,payment_currency,livemode,created_at,items:checkout_order_items(plan_id,plan_name,quantity)",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error("Could not load checkout orders");
  const parsed = z
    .array(
      z.object({
        id: z.uuid(),
        status: z.enum(["pending", "paid", "expired", "failed", "cancelled"]),
        amount_total: z.number().int(),
        payment_total: z.number().int().nullable(),
        payment_currency: z.string().nullable(),
        livemode: z.boolean(),
        created_at: z.string(),
        items: z.array(
          z.object({
            plan_id: z.string(),
            plan_name: z.string(),
            quantity: z.number().int(),
          }),
        ),
      }),
    )
    .parse(data);
  if (!parsed.length) return [];
  const { data: units, error: unitError } = await checkoutDatabase()
    .from("esim_fulfillments")
    .select("order_id,state")
    .in(
      "order_id",
      parsed.map((o) => o.id),
    );
  if (unitError) throw new Error("Could not load fulfillment status");
  return parsed.map((o) => ({
    ...o,
    recentPending:
      o.status === "pending" &&
      Date.now() - Date.parse(o.created_at) < 15 * 60000,
    amount_total: o.payment_total ?? o.amount_total,
    currency: o.payment_currency ?? "USD",
    fulfillmentStates: (units ?? [])
      .filter((u) => u.order_id === o.id)
      .map((u) => String(u.state)),
  }));
}

export async function customerSession(locale: Locale, next?: string) {
  const client = await authClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error && error.status && error.status >= 500)
    throw new Error("Account service unavailable");
  if (!user)
    redirect(
      `${authPath(locale, "login")}?next=${encodeURIComponent(safeAccountNext(next, locale))}`,
    );
  return { client, user };
}
export async function customerRecords(
  client: Awaited<ReturnType<typeof authClient>>,
  userId: string,
) {
  const [orders, esims] = await Promise.all([
    client
      .from("customer_orders")
      .select(
        "id,status,created_at,destination_name,plan_name,data_gb,days,checkout_order_id",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
    client
      .from("customer_esims")
      .select("id,order_id,status,used_gb,usage_updated_at,expires_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500),
  ]);
  if (orders.error || esims.error)
    throw new Error("Could not load customer records");
  return {
    orders: z.array(orderSchema).parse(orders.data),
    esims: z.array(esimSchema).parse(esims.data),
  };
}
export async function customerEsim(
  client: Awaited<ReturnType<typeof authClient>>,
  userId: string,
  id: string,
) {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await client
    .from("customer_esims")
    .select(
      "id,order_id,status,used_gb,usage_updated_at,expires_at,iccid,smdp_address,activation_code",
    )
    .eq("user_id", userId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load eSIM");
  return data ? privateSchema.parse(data) : null;
}
