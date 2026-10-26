import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  supportUser,
  ownedOrderContext,
  SupportError,
} from "@/lib/support/server";
import { supportFailure } from "@/lib/support/routes";
import { paymentHeaders } from "@/lib/payments/checkout-server";
export async function GET(request: NextRequest) {
  try {
    const user = await supportUser();
    const id = z.uuid().safeParse(request.nextUrl.searchParams.get("order"));
    if (!id.success) throw new SupportError("invalid");
    return NextResponse.json(
      { order: await ownedOrderContext(user.id, id.data) },
      { headers: paymentHeaders },
    );
  } catch (e) {
    return supportFailure(e);
  }
}
