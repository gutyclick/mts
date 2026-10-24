import { NextRequest, NextResponse } from "next/server";
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set(
    "x-mytripsim-locale",
    request.nextUrl.pathname.split("/")[1] === "es" ? "es" : "en",
  );
  return NextResponse.next({ request: { headers } });
}
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|images|robots.txt|sitemap.xml|opengraph-image).*)",
  ],
};
