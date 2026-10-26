import "server-only";
import { authClient } from "../supabase/auth-server";
import { checkoutDatabase } from "../payments/checkout-server";
import { esimAccess } from "../integrations/esimaccess-server";
import {
  providerSnapshot,
  adminPlanSchema,
  adminUserSchema,
  adminOrderSchema,
  overviewSchema,
  pageSchema,
  type AdminFilters,
} from "./model";
import { z } from "zod";
import { adminAssurance } from "./security-model";
export async function adminSession() {
  const client = await authClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error && error.status && error.status >= 500)
    throw new Error("Session unavailable");
  if (!user?.email_confirmed_at)
    return { user: null, ...adminAssurance(false, null, false) };
  const { data, error: roleError } = await client
    .from("admin_memberships")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleError) throw new Error("Admin authorization unavailable");
  if (!data) return { user, ...adminAssurance(false, null, false) };
  const { data: assurance, error: assuranceError } =
    await client.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) throw Error("Admin assurance unavailable");
  return {
    user,
    ...adminAssurance(
      true,
      assurance.currentLevel,
      user.factors?.some((f) => f.status === "verified") ?? false,
    ),
  };
}
export async function adminData(actor: string, filter: AdminFilters) {
  const db = checkoutDatabase();
  if (filter.tab === "summary") {
    const { data, error } = await db.rpc("admin_overview", { p_actor: actor });
    if (error) throw new Error("Admin unavailable");
    return overviewSchema.parse(data);
  }
  const { data, error } = await db.rpc("admin_records", {
    p_actor: actor,
    p_tab: filter.tab,
    p_query: filter.q,
    p_status: filter.status,
    p_environment: filter.environment,
    p_page: filter.page,
    p_user: filter.user ?? null,
  });
  if (error) throw new Error("Admin unavailable");
  const parsed = pageSchema.parse(data);
  return {
    ...parsed,
    rows:
      filter.tab === "users"
        ? z.array(adminUserSchema).parse(parsed.rows)
        : filter.tab === "orders"
          ? z.array(adminOrderSchema).parse(parsed.rows)
          : z.array(adminPlanSchema).parse(parsed.rows),
  };
}
export async function syncAdminPlan(actor: string, id: string) {
  const db = checkoutDatabase();
  const { data: raw, error } = await db.rpc("admin_sync_claim", {
    p_actor: actor,
    p_unit: id,
  });
  if (error) throw new Error("Sync unavailable");
  if (!raw) return false;
  const claim = z
    .object({
      token: z.uuid(),
      orderNo: z.string(),
      esimId: z.string(),
      iccid: z.string(),
      volume: z.coerce.number().positive(),
    })
    .parse(raw);
  try {
    const api = esimAccess();
    const [profiles, usage] = await Promise.allSettled([
      api.orderProfiles(claim.orderNo),
      api.usage([claim.esimId]),
    ]);
    if (profiles.status !== "fulfilled")
      throw new Error("Provider unavailable");
    const profile = profiles.value.find(
      (p) => p.transactionId === claim.esimId,
    );
    if (!profile) throw new Error("Missing profile");
    const snapshot = providerSnapshot(
      claim,
      profile,
      usage.status === "fulfilled"
        ? (usage.value.find((u) => u.transactionId === claim.esimId) ?? null)
        : null,
    );
    const { data, error } = await db.rpc("admin_sync_finish", {
      p_actor: actor,
      p_unit: id,
      p_token: claim.token,
      p_status: snapshot.status,
      p_smdp: snapshot.smdp,
      p_used: snapshot.used,
      p_expiry: snapshot.expiry,
      p_usage_at: snapshot.usageAt,
      p_ok: true,
    });
    if (error || data !== true) throw new Error("Sync unavailable");
    return true;
  } catch {
    await db.rpc("admin_sync_finish", {
      p_actor: actor,
      p_unit: id,
      p_token: claim.token,
      p_status: null,
      p_smdp: null,
      p_used: null,
      p_expiry: null,
      p_usage_at: null,
      p_ok: false,
    });
    throw new Error("Provider unavailable");
  }
}
