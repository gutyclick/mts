import { NextRequest, NextResponse } from "next/server";
import { sessionResponse } from "./lib/supabase/auth-proxy";
import { isPortalHost, portalRewrite } from "./lib/portal/routing";
import { languageCookie, languageEntryPath } from "./lib/language-preference";
export async function proxy(request: NextRequest) {
  const entry = languageEntryPath(
    request.nextUrl.pathname,
    request.cookies.get(languageCookie)?.value,
    request.headers.get("accept-language"),
  );
  if (entry) {
    const target = request.nextUrl.clone();
    target.pathname = entry;
    const response = NextResponse.redirect(target, 307);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Vary", "Accept-Language, Cookie");
    if (
      isPortalHost(request.headers.get("host")) ||
      entry.startsWith("/portal/")
    )
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  const headers = new Headers(request.headers);
  // Surface headers only select presentation. They never authorize data access.
  const preview = /^\/portal(?:\/|$)/.test(request.nextUrl.pathname);
  // Next's internal rewrite can normalize Host to localhost while preserving
  // the original forwarded host. Keep clean navigation on this second pass.
  const internalPortalRewrite =
    preview &&
    request.headers.get("x-mytripsim-surface") === "portal" &&
    isPortalHost(request.headers.get("x-forwarded-host"));
  const portal =
    isPortalHost(request.headers.get("host")) || internalPortalRewrite;
  headers.set(
    "x-mytripsim-surface",
    portal ? "portal" : preview ? "portal-preview" : "store",
  );
  if (portal && /^\/api\/portal(?:\/|$)/.test(request.nextUrl.pathname)) {
    const response = await sessionResponse(request, headers);
    response.headers.set("Cache-Control", "private, no-store, max-age=0");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
    return response;
  }
  if (portal || preview) {
    const path = portal
      ? portalRewrite(request.nextUrl.pathname)
      : request.nextUrl.pathname;
    headers.set(
      "x-mytripsim-locale",
      path.split("/")[2] === "en" ? "en" : "es",
    );
    const refreshed =
      !/^\/(?:api(?:\/|$)|_next(?:\/|$)|images(?:\/|$)|icons(?:\/|$)|flags(?:\/|$)|illustrations(?:\/|$)|robots\.txt|sitemap\.xml|manifest\.webmanifest|favicon\.ico|icon\.png|apple-icon\.png|logomytripsim\.png|opengraph-image)/.test(
        request.nextUrl.pathname,
      )
        ? await sessionResponse(request, headers)
        : null;
    let result: NextResponse;
    if (portal && request.nextUrl.pathname === "/robots.txt") {
      result = new NextResponse("User-agent: *\nDisallow: /\n", {
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    } else if (
      portal &&
      /^\/(api(?:\/|$)|sitemap\.xml|manifest\.webmanifest|opengraph-image)/.test(
        request.nextUrl.pathname,
      )
    ) {
      result = new NextResponse(null, { status: 404 });
    } else if (
      portal &&
      /^\/(?:_next|images|icons|flags|illustrations)(?:\/|$)|^\/(?:favicon\.ico|icon\.png|apple-icon\.png|logomytripsim\.png)$/.test(
        request.nextUrl.pathname,
      )
    ) {
      return NextResponse.next({ request: { headers } });
    } else if (portal && !preview) {
      const target = request.nextUrl.clone();
      target.pathname = path;
      result = NextResponse.rewrite(target, { request: { headers } });
    } else {
      result = NextResponse.next({ request: { headers } });
    }
    result.headers.set("Cache-Control", "private, no-store, max-age=0");
    result.headers.set("Referrer-Policy", "no-referrer");
    result.headers.set("X-Robots-Tag", "noindex, nofollow");
    refreshed?.cookies.getAll().forEach((cookie) => result.cookies.set(cookie));
    return result;
  }
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
    {
      source: "/:path*",
      has: [{ type: "host", value: "portal.mytripsim.com" }],
    },
  ],
};
