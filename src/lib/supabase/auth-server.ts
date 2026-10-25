import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { catalogConfig } from "./catalog-api";

export async function authClient() {
  const config = catalogConfig(process.env);
  if (!config) throw new Error("Account service is not configured");
  const store = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            store.set(name, value, options),
          );
        } catch {
          /* Server Components cannot write; Proxy refreshes before rendering. */
        }
      },
    },
  });
}
