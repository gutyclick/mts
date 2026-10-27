import { NextRequest, NextResponse } from "next/server";
import { currencyCode } from "@/lib/currency";
import { currencyQuote } from "@/lib/payments/currency-server";
const headers = {
  "Cache-Control": "public, max-age=0, s-maxage=60",
  "X-Robots-Tag": "noindex, nofollow",
  "Referrer-Policy": "no-referrer",
};
export async function GET(request: NextRequest) {
  const currency = currencyCode(request.nextUrl.searchParams.get("currency"));
  if (!currency)
    return NextResponse.json(
      { error: "invalid_currency" },
      { status: 400, headers: { ...headers, "Cache-Control": "no-store" } },
    );
  try {
    return NextResponse.json(await currencyQuote(currency), { headers });
  } catch {
    return NextResponse.json(
      { error: "currency_unavailable" },
      { status: 503, headers: { ...headers, "Cache-Control": "no-store" } },
    );
  }
}
