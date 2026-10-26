import { NextRequest, NextResponse } from "next/server";
import {
  conversationSession,
  conversationToken,
} from "@/lib/support/conversations-server";
import { guestSupportCookie } from "@/lib/support/conversations";
import { supportFailure } from "@/lib/support/routes";
import { paymentHeaders } from "@/lib/payments/checkout-server";
export async function GET(request: NextRequest) {
  try {
    const token = conversationToken(request);
    const response = NextResponse.json(
      await conversationSession(request, token),
      {
        headers: paymentHeaders,
      },
    );
    response.cookies.set(guestSupportCookie, token, {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/api/support",
      maxAge: 7 * 86400,
    });
    return response;
  } catch (e) {
    return supportFailure(e);
  }
}
