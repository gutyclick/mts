import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { catalogConfig } from "./catalog-api";

export async function sessionResponse(request: NextRequest, headers: Headers) {
  let response = NextResponse.next({ request: { headers } });
  const config = catalogConfig(process.env);
  if (
    !config ||
    !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))
  )
    return response;
  const client = createServerClient(config.url, config.key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        headers.set("cookie", request.headers.get("cookie") ?? "");
        // Keep the current locale header and every refreshed cookie together.
        response = NextResponse.next({ request: { headers } });
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  await client.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}
