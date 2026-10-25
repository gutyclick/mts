import "server-only";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { catalogConfig } from "../supabase/catalog-api";
import { checkoutOrigin } from "./checkout-core";

export function checkoutConfigured() {
  return (
    process.env.STRIPE_TEST_CHECKOUT_ENABLED === "true" &&
    /^(sk|rk)_test_[a-zA-Z0-9]{16,}$/.test(
      process.env.STRIPE_TEST_SECRET_KEY ?? "",
    ) &&
    /^sb_secret_/.test(process.env.SUPABASE_CHECKOUT_SECRET_KEY ?? "") &&
    (process.env.CHECKOUT_REQUEST_SECRET?.length ?? 0) >= 32 &&
    /^whsec_/.test(process.env.STRIPE_TEST_WEBHOOK_SECRET ?? "")
  );
}
export function checkoutStripe() {
  const key = process.env.STRIPE_TEST_SECRET_KEY ?? "";
  if (!/^(sk|rk)_test_[a-zA-Z0-9]{16,}$/.test(key))
    throw new Error("Test Stripe not configured");
  return new Stripe(key, { maxNetworkRetries: 2, timeout: 15000 });
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
