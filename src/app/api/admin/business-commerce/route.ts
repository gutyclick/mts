import { after, NextRequest, NextResponse } from "next/server";
import { adminSession } from "@/lib/admin/server";
import {
  checkoutDatabase,
  paymentOrigin,
} from "@/lib/payments/checkout-server";
import { businessBody, businessHeaders } from "@/lib/portal/server";
import {
  commerceAdminAction,
  commerceError,
} from "@/lib/portal/commerce-validation";
import {
  commerceReadiness,
  refreshBusinessCost,
  commercialOrder,
} from "@/lib/portal/commerce-server";
import { runBusinessFulfillmentWorker } from "@/lib/portal/fulfillment-server";
import { runBusinessNotificationWorker } from "@/lib/portal/notification-server";
export const runtime = "nodejs";
export const maxDuration = 60;
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: businessHeaders });
async function authorize() {
  const session = await adminSession();
  const denied = !session.user
    ? reply({ error: "unauthorized" }, 401)
    : session.needsMfa
      ? reply({ error: "mfa_required" }, 428)
      : !session.admin
        ? reply({ error: "forbidden" }, 403)
        : null;
  return { session, denied };
}
export async function GET(request: NextRequest) {
  try {
    const { session, denied } = await authorize();
    if (denied) return denied;
    const db = checkoutDatabase();
    const destination = request.nextUrl.searchParams.get("destination");
    if (destination) {
      if (!/^[a-z0-9-]{1,100}$/.test(destination))
        return reply({ error: "invalid" }, 400);
      const { data, error } = await db
        .from("catalog_plans")
        .select("id,name,days,data_gb")
        .eq("destination_slug", destination)
        .eq("is_published", true)
        .eq("kind", "fixed")
        .order("data_gb")
        .limit(250);
      return error
        ? reply({ error: "unavailable" }, 503)
        : reply({ plans: data });
    }
    const result = await db.rpc("b2b_commerce_records", {
      p_actor: session.user!.id,
    });
    return result.error
      ? reply({ error: "unavailable" }, 503)
      : reply({ ...result.data, readiness: commerceReadiness() });
  } catch {
    return reply({ error: "unavailable" }, 503);
  }
}
export async function POST(request: NextRequest) {
  if (
    process.env.NODE_ENV === "production" &&
    request.headers.get("origin") !== paymentOrigin()
  )
    return reply({ error: "forbidden" }, 403);
  try {
    const { session, denied } = await authorize();
    if (denied) return denied;
    const parsed = commerceAdminAction.safeParse(await businessBody(request));
    if (!parsed.success) return reply({ error: "invalid" }, 400);
    const value = parsed.data,
      db = checkoutDatabase();
    let payload: Record<string, unknown>;
    if (value.action === "save_settings") {
      const readiness = commerceReadiness();
      if (
        (value.value.stripe_enabled && !readiness.stripe) ||
        (value.value.yappy_enabled && !readiness.yappy) ||
        (value.value.issuance_enabled && !readiness.issuance)
      )
        return reply({ error: "not_configured" }, 409);
      payload = value.value;
    } else if (value.action === "save_tariff")
      payload = {
        plan_id: value.planId,
        company_id: value.companyId,
        unit_cents: value.unitCents,
        active: value.active,
      };
    else if (value.action === "publish_quote") {
      const req = await db
        .from("b2b_order_requests")
        .select("plan_id")
        .eq("id", value.requestId)
        .single();
      if (req.error) return reply({ error: "not_found" }, 404);
      await refreshBusinessCost(req.data.plan_id);
      payload = {
        request_id: value.requestId,
        version: value.version,
        unit_cents: value.unitCents,
        tax_cents: value.taxCents,
        valid_hours: value.validHours,
      };
    } else if (value.action === "confirm_transfer") {
      await refreshBusinessCost((await commercialOrder(value.orderId)).plan_id);
      payload = {
        order_id: value.orderId,
        reference: value.reference,
        amount_cents: value.amountCents,
      };
    } else if (value.action === "release") {
      if (!commerceReadiness().issuance)
        return reply({ error: "not_configured" }, 409);
      await refreshBusinessCost((await commercialOrder(value.orderId)).plan_id);
      payload = { order_id: value.orderId };
    } else {
      if (
        !process.env.RESEND_API_KEY?.startsWith("re_") ||
        !commerceReadiness().issuance
      )
        return reply({ error: "not_configured" }, 409);
      const job = await db.rpc("b2b_notification_enqueue", {
        p_actor: session.user!.id,
        p_order: value.orderId,
      });
      if (job.error) return reply({ error: commerceError(job.error) }, 409);
      after(async () => {
        await runBusinessNotificationWorker().catch(() => {});
      });
      return reply({ ok: true, id: job.data });
    }
    const result = await db.rpc("b2b_commerce_admin", {
      p_actor: session.user!.id,
      p_action: value.action,
      p_value: payload,
    });
    if (!result.error && value.action === "release")
      after(async () => {
        await runBusinessFulfillmentWorker().catch(() => {});
      });
    return result.error
      ? reply({ error: commerceError(result.error) }, 409)
      : reply({ ok: true, id: result.data });
  } catch (error) {
    return reply({ error: commerceError(error) }, 503);
  }
}
