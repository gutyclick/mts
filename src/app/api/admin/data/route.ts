import { NextRequest, NextResponse } from "next/server";
import { adminSession, adminData } from "@/lib/admin/server";
import { adminFilters } from "@/lib/admin/model";
import { paymentHeaders } from "@/lib/payments/checkout-server";
export async function GET(request: NextRequest) {
  const fail = (status: number) =>
    NextResponse.json(
      { error: "admin_unavailable" },
      { status, headers: paymentHeaders },
    );
  try {
    const session = await adminSession();
    if (!session.user) return fail(401);
    if (session.needsMfa) return fail(428);
    if (!session.admin) return fail(403);
    const filters = adminFilters.safeParse(
      Object.fromEntries(request.nextUrl.searchParams),
    );
    if (!filters.success) return fail(400);
    return NextResponse.json(await adminData(session.user.id, filters.data), {
      headers: paymentHeaders,
    });
  } catch {
    return fail(503);
  }
}
