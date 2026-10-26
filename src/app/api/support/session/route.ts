import { NextResponse } from "next/server";
import { supportSession } from "@/lib/support/server";
import { supportFailure } from "@/lib/support/routes";
import { paymentHeaders } from "@/lib/payments/checkout-server";
export async function GET() {
  try {
    return NextResponse.json(await supportSession(), {
      headers: paymentHeaders,
    });
  } catch (e) {
    return supportFailure(e);
  }
}
