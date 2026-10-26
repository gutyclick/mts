import { NextRequest, NextResponse } from "next/server";
import { sessionResponse } from "./lib/supabase/auth-proxy";
export async function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(
    "x-mytripsim-locale",
    request.nextUrl.pathname.split("/")[1] === "es" ? "es" : "en",
  );
  const response: NextResponse = await sessionResponse(request, headers);
  if (
    ((request.nextUrl.pathname.endsWith("/instalar") ||
      request.nextUrl.pathname.endsWith("/install")) &&
      request.nextUrl.searchParams.has("esim")) ||
    /\/(support|admin|mis-esim|my-esims|compra|checkout|iniciar-sesion|sign-in|crear-cuenta|sign-up|recuperar-contrasena|forgot-password|nueva-contrasena|reset-password|auth)(\/|$)/.test(
      request.nextUrl.pathname,
    )
  ) {
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return response;
}
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|icons|manifest.webmanifest|images|flags|illustrations|robots.txt|sitemap.xml|opengraph-image).*)",
  ],
};
