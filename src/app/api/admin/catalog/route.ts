import { curateCatalog, type PlanMerchandising } from "@/lib/catalog-curation";
import connectivityEvidence from "@/data/catalog-connectivity-evidence.json";
import type { Plan, PlanDetails } from "@/lib/plan-utils";
import { NextRequest, NextResponse } from "next/server";
import { adminSession } from "@/lib/admin/server";
import {
  checkoutDatabase,
  paymentHeaders,
  paymentOrigin,
} from "@/lib/payments/checkout-server";
import { catalogMerchandisingRequestSchema } from "@/lib/admin/catalog-merchandising";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: paymentHeaders });
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
    const { denied } = await authorize();
    if (denied) return denied;
    const slug = request.nextUrl.searchParams.get("destination");
    const db = checkoutDatabase();
    if (!slug) {
      const result = await db
        .from("catalog_destinations")
        .select("slug,name")
        .order("slug")
        .limit(1000);
      if (result.error) return reply({ error: "unavailable" }, 503);
      return reply({ destinations: result.data });
    }
    const [plans, destination, identity] = await Promise.all([
      db
        .from("catalog_plans")
        .select(
          "id,name,days,data_gb,kind,allowance,coverage_code,details,retail_price_cents,is_published,catalog_plan_merchandising(*)",
        )
        .eq("destination_slug", slug)
        .order("id")
        .limit(1000),
      db
        .from("catalog_destination_merchandising")
        .select("*")
        .eq("destination_slug", slug)
        .maybeSingle(),
      db
        .from("catalog_destinations")
        .select("code,type,is_published")
        .eq("slug", slug)
        .single(),
    ]);
    if (plans.error || destination.error || identity.error)
      return reply({ error: "unavailable" }, 503);
    const availability = plans.data!.length
      ? await db
          .from("catalog_available_plan_ids")
          .select("id")
          .in(
            "id",
            plans.data!.map((p) => p.id),
          )
      : { data: [], error: null };
    if (availability.error) return reply({ error: "unavailable" }, 503);
    const available = new Set(availability.data!.map((p) => p.id));
    const rows = plans.data!;
    const overrides = rows.flatMap((p) =>
      p.catalog_plan_merchandising
        ? [p.catalog_plan_merchandising as unknown as PlanMerchandising]
        : [],
    );
    const preview = curateCatalog({
      plans: rows
        .filter(
          (p) =>
            p.is_published &&
            identity.data!.is_published &&
            available.has(p.id),
        )
        .map(
          (p) =>
            ({
              id: p.id,
              name: p.name,
              days: p.days,
              dataGb: Number(p.data_gb),
              kind: p.kind,
              allowance: p.allowance,
              coverageCode: p.coverage_code,
              details: p.details as PlanDetails,
              retailPriceCents: p.retail_price_cents,
            }) as Plan,
        ),
      destinationCode: identity.data!.code,
      destinationType: identity.data!.type,
      overrides,
      approvedModes: destination.data?.approved_modalities,
      evidence: connectivityEvidence,
    });
    const considered = new Set(preview.decisions.map((d) => d.planId));
    for (const p of rows)
      if (!considered.has(p.id))
        preview.decisions.push({
          planId: p.id,
          selected: false,
          reason: !p.is_published ? "unpublished" : "provider_unavailable",
        });
    return reply({ plans: rows, destination: destination.data, preview });
  } catch {
    return reply({ error: "unavailable" }, 503);
  }
}
export async function POST(request: NextRequest) {
  if (request.headers.get("origin") !== paymentOrigin())
    return reply({ error: "forbidden" }, 403);
  try {
    const { session, denied } = await authorize();
    if (denied) return denied;
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      return reply({ error: "invalid" }, 415);
    if (Number(request.headers.get("content-length")) > 8192)
      return reply({ error: "invalid" }, 413);
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > 8192)
      return reply({ error: "invalid" }, 413);
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return reply({ error: "invalid" }, 400);
    }
    const input = catalogMerchandisingRequestSchema.safeParse(value);
    if (!input.success) return reply({ error: "invalid" }, 400);
    const result = await checkoutDatabase().rpc("catalog_merchandising_save", {
      p_actor: session.user!.id,
      p_entity: input.data.entity,
      p_value: input.data.value,
    });
    if (result.error) return reply({ error: "conflict" }, 409);
    return reply({ ok: true, value: result.data });
  } catch {
    return reply({ error: "unavailable" }, 503);
  }
}
