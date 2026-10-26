import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { conversationRequest } from "@/lib/support/conversations";
import {
  conversationActor,
  conversationDetail,
  mutateConversation,
} from "@/lib/support/conversations-server";
import { supportJSON, supportOrigin, SupportError } from "@/lib/support/server";
import { supportFailure } from "@/lib/support/routes";
import { paymentHeaders } from "@/lib/payments/checkout-server";
export async function GET(request: NextRequest) {
  try {
    const id = z.uuid().safeParse(request.nextUrl.searchParams.get("id"));
    if (!id.success) throw new SupportError("invalid");
    return NextResponse.json(
      await conversationDetail(await conversationActor(request), id.data),
      { headers: paymentHeaders },
    );
  } catch (e) {
    return supportFailure(e);
  }
}
export async function POST(request: NextRequest) {
  try {
    supportOrigin(request);
    const body = conversationRequest.safeParse(
      await supportJSON(request, 5000),
    );
    if (!body.success) throw new SupportError("invalid");
    return NextResponse.json(
      await mutateConversation(
        await conversationActor(request),
        body.data,
        request,
      ),
      { headers: paymentHeaders },
    );
  } catch (e) {
    return supportFailure(e);
  }
}
