import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { browserCookie, validBrowserToken } from "@/lib/payments/checkout-core";
import { simcoinsCheckoutEnabled } from "@/lib/simcoins/checkout-server";
import {
  paymentEnvironment,
  checkoutConfigured,
  paymentHeaders,
} from "@/lib/payments/checkout-server";

export function GET(request: NextRequest) {
  const enabled = checkoutConfigured();
  const response = NextResponse.json(
    {
      enabled,
      simcoinsEnabled: enabled && simcoinsCheckoutEnabled(),
      mode: paymentEnvironment(process.env).mode,
      publishableKey: enabled
        ? paymentEnvironment(process.env).publicKey
        : null,
    },
    { headers: paymentHeaders },
  );
  if (enabled && !validBrowserToken(request.cookies.get(browserCookie)?.value))
    response.cookies.set(browserCookie, randomBytes(32).toString("hex"), {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/api/checkout",
      maxAge: 86400,
    });
  return response;
}
