import { NextRequest, NextResponse } from "next/server";
import {
  beginRetailYappy,
  RetailYappyError,
} from "@/lib/payments/yappy-retail";
import { paymentHeaders } from "@/lib/payments/checkout-server";
import { catalogPreviewEnabled } from "@/lib/catalog-preview";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  if (catalogPreviewEnabled(process.env))
    return NextResponse.json(
      { error: "catalog_preview_only" },
      { status: 409, headers: paymentHeaders },
    );
  try {
    return NextResponse.json(await beginRetailYappy(request), {
      headers: paymentHeaders,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof RetailYappyError ? error.code : "yappy_unavailable",
      },
      {
        status: error instanceof RetailYappyError ? error.status : 503,
        headers: paymentHeaders,
      },
    );
  }
}
