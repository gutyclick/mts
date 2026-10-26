import { NextRequest, NextResponse } from "next/server";
import { chatRequest } from "@/lib/support/model";
import {
  chatSupport,
  supportOrigin,
  supportJSON,
  SupportError,
} from "@/lib/support/server";
import { supportFailure } from "@/lib/support/routes";
import { paymentHeaders } from "@/lib/payments/checkout-server";
export const maxDuration = 60;
export async function POST(request: NextRequest) {
  try {
    supportOrigin(request);
    const body = chatRequest.safeParse(await supportJSON(request));
    if (!body.success) throw new SupportError("invalid");
    return NextResponse.json(await chatSupport(body.data, request), {
      headers: paymentHeaders,
    });
  } catch (e) {
    return supportFailure(e);
  }
}
