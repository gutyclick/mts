import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import { z } from "zod";
import {
  businessIdentity,
  businessWorkspace,
  businessHeaders,
} from "@/lib/portal/server";
import { commercialOrder } from "@/lib/portal/commerce-server";
import { checkoutDatabase } from "@/lib/payments/checkout-server";
import { createStoredZip } from "@/lib/portal/zip";
export const runtime = "nodejs";
export const maxDuration = 60;
const xml = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export async function GET(request: NextRequest) {
  const fail = (status: number) =>
    NextResponse.json(
      {
        error:
          status === 401
            ? "unauthorized"
            : status === 403
              ? "forbidden"
              : "unavailable",
      },
      { status, headers: businessHeaders },
    );
  try {
    const { client, user, needsMfa } = await businessIdentity();
    if (!user) return fail(401);
    if (needsMfa) return fail(403);
    const orderId = z
      .uuid()
      .safeParse(request.nextUrl.searchParams.get("orderId"));
    const unitId = request.nextUrl.searchParams.get("unitId");
    if (!orderId.success || (unitId && !z.uuid().safeParse(unitId).success))
      return fail(400);
    const order = await commercialOrder(orderId.data),
      workspace = await businessWorkspace(client);
    const member = workspace.companies.find((c) => c.id === order.company_id);
    if (
      !member ||
      !["owner", "coordinator"].includes(member.role) ||
      workspace.restricted
    )
      return fail(403);
    const scoped = await client.rpc("b2b_commerce_workspace", {
      p_trip: order.trip_id,
    });
    if (scoped.error) return fail(403);
    if (!order.paid_at || !["provisioning", "ready"].includes(order.state))
      return fail(409);
    let query = checkoutDatabase()
      .from("b2b_units")
      .select("id,slot,smdp_address,activation_code,iccid,apn")
      .eq("order_id", order.id)
      .eq("state", "ready")
      .order("slot")
      .limit(1000);
    if (unitId) query = query.eq("id", unitId);
    const result = await query;
    if (result.error || !result.data.length) return fail(404);
    const units = z
      .array(
        z.object({
          id: z.uuid(),
          slot: z.number().int().positive(),
          smdp_address: z.string().regex(/^[A-Za-z0-9.-]+$/),
          activation_code: z.string().regex(/^[A-Za-z0-9_-]+$/),
          iccid: z.string().regex(/^\d{15,25}$/),
          apn: z.string().nullable(),
        }),
      )
      .parse(result.data);
    const entries = [];
    for (const unit of units) {
      const qr = await QRCode.toDataURL(
        `LPA:1$${unit.smdp_address}$${unit.activation_code}`,
        { width: 320, margin: 3, errorCorrectionLevel: "M" },
      );
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800"><rect width="640" height="800" rx="28" fill="#f2f7ff"/><rect x="24" y="24" width="592" height="752" rx="24" fill="white"/><g font-family="Arial,sans-serif" fill="#122443" text-anchor="middle"><text x="320" y="80" font-size="32" font-weight="700">MyTripSim</text><text x="320" y="120" font-size="18">${xml(order.plan_name.slice(0, 60))}</text><text x="320" y="150" font-size="16">eSIM ${unit.slot} · ${xml(order.id.slice(0, 8).toUpperCase())}</text><image href="${qr}" x="160" y="180" width="320" height="320"/><text x="320" y="540" font-size="15">Escanea para instalar / Scan to install</text><text x="320" y="582" font-size="14">SM-DP+: ${xml(unit.smdp_address)}</text><text x="320" y="615" font-size="12">${xml(unit.activation_code)}</text><text x="320" y="660" font-size="13">ICCID: ${xml(unit.iccid)}</text><text x="320" y="708" font-size="12">QR privado · Un solo dispositivo / Private · One device</text></g></svg>`;
      entries.push({
        name: `MyTripSim-${order.id.slice(0, 8)}-${String(unit.slot).padStart(3, "0")}.svg`,
        data: new TextEncoder().encode(svg),
      });
    }
    const single = !!unitId,
      body = single ? entries[0].data : createStoredZip(entries);
    return new NextResponse(Buffer.from(body), {
      headers: {
        ...businessHeaders,
        "Content-Type": single ? "image/svg+xml" : "application/zip",
        "Content-Disposition": `attachment; filename="${single ? entries[0].name : `MyTripSim-${order.id.slice(0, 8)}.zip`}"`,
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy":
          "default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox",
      },
    });
  } catch {
    return fail(503);
  }
}
