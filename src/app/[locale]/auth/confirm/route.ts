import { NextRequest, NextResponse } from "next/server";
import { authClient } from "@/lib/supabase/auth-server";
import { authPath } from "@/lib/auth-routes";
import { isLocale } from "@/lib/i18n";
import { experiencePath } from "@/lib/experience-routes";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  if (!isLocale(locale)) return new NextResponse(null, { status: 404 });
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const code = request.nextUrl.searchParams.get("code");
  const client = await authClient();
  let valid = false;
  if (
    token_hash &&
    /^[a-zA-Z0-9_-]{20,512}$/.test(token_hash) &&
    (type === "signup" || type === "recovery")
  ) {
    const { error } = await client.auth.verifyOtp({ token_hash, type });
    valid = !error;
  } else if (code && /^[a-zA-Z0-9_-]{20,512}$/.test(code)) {
    const { error } = await client.auth.exchangeCodeForSession(code);
    valid = !error;
  }
  const destination = valid
    ? type === "recovery" ||
      (code && request.nextUrl.searchParams.get("flow") === "recovery")
      ? authPath(locale, "reset")
      : experiencePath(locale, "wallet")
    : `${authPath(locale, "login")}?error=link`;
  // Never derive the destination origin from forwarded headers or the request host.
  const base = process.env.AUTH_SITE_URL || "https://www.mytripsim.com";
  const response = NextResponse.redirect(new URL(destination, base), 303);
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
