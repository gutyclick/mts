import { NextRequest, NextResponse } from "next/server";
import { workerAuthorized } from "@/lib/payments/worker-auth";
import { paymentHeaders } from "@/lib/payments/checkout-server";
import { runOperationsWorker } from "@/lib/operations/server";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  if (!(await workerAuthorized(request)))
    return NextResponse.json(
      { error: "unauthorized" },
      { status: 401, headers: paymentHeaders },
    );
  try {
    return NextResponse.json(await runOperationsWorker(), {
      headers: paymentHeaders,
    });
  } catch {
    return NextResponse.json(
      { error: "operations_unavailable" },
      { status: 503, headers: paymentHeaders },
    );
  }
}
