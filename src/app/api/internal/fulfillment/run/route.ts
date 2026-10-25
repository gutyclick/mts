import { NextRequest, NextResponse } from "next/server";
import { workerAuthorized } from "@/lib/payments/worker-auth";
import { paymentHeaders } from "@/lib/payments/checkout-server";
import { runFulfillmentWorker } from "@/lib/fulfillment/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  if (!(await workerAuthorized(request)))
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: paymentHeaders },
    );
  try {
    return NextResponse.json(await runFulfillmentWorker(), {
      headers: paymentHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "worker_unavailable" },
      { status: 503, headers: paymentHeaders },
    );
  }
}
