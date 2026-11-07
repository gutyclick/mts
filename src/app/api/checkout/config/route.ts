import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { browserCookie, validBrowserToken } from "@/lib/payments/checkout-core";
import { simcoinsCheckoutEnabled } from "@/lib/simcoins/checkout-server";
import { retailYappySettings } from "@/lib/payments/yappy-policy";
import {
  paymentEnvironment,
  checkoutConfigured,
  paymentHeaders,
} from "@/lib/payments/checkout-server";

export function GET(request: NextRequest) {
  const enabled = checkoutConfigured();
  const yappy = !!retailYappySettings(
    process.env,
    paymentEnvironment(process.env).mode === "live",
  );
  const response = NextResponse.json(
    {
      enabled,
      yappyEnabled: yappy,
      simcoinsEnabled: enabled && simcoinsCheckoutEnabled(),
      mode: paymentEnvironment(process.env).mode,
      publishableKey: enabled
        ? paymentEnvironment(process.env).publicKey
        : null,
    },
    { headers: paymentHeaders },
  );
  if (
    (enabled || yappy) &&
    !validBrowserToken(request.cookies.get(browserCookie)?.value)
  )
    response.cookies.set(browserCookie, randomBytes(32).toString("hex"), {
      httpOnly: true,
      secure: request.nextUrl.protocol === "https:",
      sameSite: "lax",
      path: "/api/checkout",
      maxAge: 86400,
    });
  return response;
}
