import "server-only";
import Stripe from "stripe";
import { paymentEnvironment, paymentMode } from "./checkout-mode";
export { paymentEnvironment, paymentMode } from "./checkout-mode";
import { createClient } from "@supabase/supabase-js";
import { catalogConfig } from "../supabase/catalog-api";
import { checkoutOrigin } from "./checkout-core";

export function checkoutConfigured() {
  const c = paymentEnvironment(process.env);
  return (
    c.enabled &&
    (!c.live ||
      !process.env.VERCEL_ENV ||
      process.env.VERCEL_ENV === "production") &&
    new RegExp("^(sk|rk)_" + c.mode + "_[a-zA-Z0-9]{16,}$").test(c.secret) &&
    new RegExp("^pk_" + c.mode + "_[a-zA-Z0-9]{16,}$").test(c.publicKey) &&
    /^sb_secret_/.test(process.env.SUPABASE_CHECKOUT_SECRET_KEY ?? "") &&
    (process.env.CHECKOUT_REQUEST_SECRET?.length ?? 0) >= 32 &&
    /^whsec_/.test(c.webhook)
  );
}
export function checkoutStripe(live = paymentMode(process.env) === "live") {
  const c = paymentEnvironment(process.env, live ? "live" : "test");
  if (!new RegExp("^(sk|rk)_" + c.mode + "_[a-zA-Z0-9]{16,}$").test(c.secret))
    throw new Error("Stripe not configured");
  return new Stripe(c.secret, { maxNetworkRetries: 2, timeout: 15000 });
}
export function checkoutDatabase() {
  const config = catalogConfig(process.env);
  const key = process.env.SUPABASE_CHECKOUT_SECRET_KEY;
  if (!config || !key?.startsWith("sb_secret_"))
    throw new Error("Checkout database not configured");
  return createClient(config.url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) =>
        fetch(input, {
          ...init,
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        }),
    },
  });
}
export function paymentOrigin() {
  return checkoutOrigin(
    process.env.CHECKOUT_SITE_URL ??
      process.env.AUTH_SITE_URL ??
      "https://www.mytripsim.com",
  );
}
export const paymentHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
};
