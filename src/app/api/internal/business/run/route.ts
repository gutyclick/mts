import { NextRequest, NextResponse } from "next/server";
import { workerAuthorized } from "@/lib/payments/worker-auth";
import { businessHeaders } from "@/lib/portal/server";
import { runBusinessFulfillmentWorker } from "@/lib/portal/fulfillment-server";
import { runBusinessNotificationWorker } from "@/lib/portal/notification-server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  if (!(await workerAuthorized(request)))
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: businessHeaders },
    );
  try {
    const task = request.nextUrl.searchParams.get("task");
    if (task !== "units" && task !== "notifications")
      return NextResponse.json(
        { error: "invalid" },
        { status: 400, headers: businessHeaders },
      );
    return NextResponse.json(
      await (task === "units"
        ? runBusinessFulfillmentWorker()
        : runBusinessNotificationWorker()),
      { headers: businessHeaders },
    );
  } catch {
    return NextResponse.json(
      { error: "unavailable" },
      { status: 503, headers: businessHeaders },
    );
  }
}
