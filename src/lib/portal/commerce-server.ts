import "server-only";
import { z } from "zod";
import {
  checkoutConfigured,
  checkoutDatabase,
  paymentMode,
} from "../payments/checkout-server";
import { esimAccessConfig } from "../integrations/esimaccess-api";
import { yappyConfig } from "../integrations/yappy";
import {
  promotionCostSchema,
  refreshPromotionCosts,
} from "../payments/promotion-costs";
import { commerceSettings } from "./commerce-validation";

export const portalOrigin = "https://portal.mytripsim.com";
export function commerceReadiness() {
  const live = paymentMode(process.env) === "live";
  return {
    stripe: checkoutConfigured(),
    yappy:
      process.env.B2B_YAPPY_ENABLED === "true" &&
      !!yappyConfig(process.env, live),
    issuance:
      process.env.B2B_ISSUANCE_ENABLED === "true" &&
      live &&
      !!esimAccessConfig(process.env),
  };
}
export async function commercialSettings() {
  const result = await checkoutDatabase()
    .from("b2b_commerce_settings")
    .select("*")
    .eq("id", true)
    .single();
  if (result.error) throw Error("unavailable");
  // Strip database timestamps/identity; reject invalid operational settings.
  return commerceSettings.parse(
    Object.fromEntries(
      Object.keys(commerceSettings.shape).map((k) => [k, result.data[k]]),
    ),
  );
}
export async function refreshBusinessCost(planId: string) {
  const db = checkoutDatabase();
  const [plan, cost] = await Promise.all([
    db
      .from("catalog_plans")
      .select("id,allowance,days,coverage_code")
      .eq("id", planId)
      .eq("is_published", true)
      .eq("kind", "fixed")
      .single(),
    db
      .from("simcoins_private_costs")
      .select("plan_id,wholesale_unit_units,observed_at")
      .eq("plan_id", planId),
  ]);
  if (plan.error || cost.error) throw Error("unavailable");
  const p = z
    .object({
      id: z.string(),
      allowance: z.string(),
      days: z.number().int(),
      coverage_code: z.string(),
    })
    .parse(plan.data);
  const costs = await refreshPromotionCosts(
    [p],
    z.array(promotionCostSchema).parse(cost.data),
    900,
  );
  if (
    !costs.some(
      (v) =>
        v.plan_id === planId && Date.parse(v.observed_at) > Date.now() - 900000,
    )
  )
    throw Error("stale_cost");
}
export const commercialOrderSchema = z.object({
  id: z.uuid(),
  request_id: z.uuid(),
  company_id: z.uuid(),
  trip_id: z.uuid(),
  plan_id: z.string(),
  plan_name: z.string(),
  quantity: z.number().int().positive(),
  unit_cents: z.number().int().positive(),
  subtotal_cents: z.number().int().positive(),
  tax_cents: z.number().int().nonnegative(),
  total_cents: z.number().int().positive(),
  currency: z.literal("USD"),
  state: z.string(),
  paid_at: z.string().nullable(),
  payment_method: z.string().nullable(),
  quote_expires_at: z.string(),
});
export async function commercialOrder(id: string) {
  const result = await checkoutDatabase()
    .from("b2b_orders")
    .select("*")
    .eq("id", id)
    .single();
  if (result.error) throw Error("not_found");
  return commercialOrderSchema.parse(result.data);
}
