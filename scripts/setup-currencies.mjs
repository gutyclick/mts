// Operator-only warm-up. Informational quote; never makes a payment or prints credentials.
import { createClient } from "@supabase/supabase-js";
import { fetchStripeRateSnapshot } from "../src/lib/payments/fx-rates.ts";
process.loadEnvFile(".env.local");
let token,
  stage = "claim";
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_CHECKOUT_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
try {
  const claim = await db.rpc("fx_claim_refresh");
  if (claim.error) throw Error();
  token = claim.data;
  if (!token) {
    console.log("Currency pricing already warm or refresh currently leased.");
  } else {
    stage = "informational quote";
    const snapshot = await fetchStripeRateSnapshot(
      process.env.STRIPE_LIVE_SECRET_KEY ?? "",
    );
    stage = "private storage";
    const saved = await db.rpc("fx_store_snapshot", {
      p_token: token,
      p_provider: snapshot.provider,
      p_sampled: snapshot.sampledAt,
      p_rates: snapshot.rates,
    });
    if (saved.error) throw Error();
    console.log(
      "18 currencies prepared from live informational base rates. No payment or FX lock created.",
    );
  }
} catch {
  if (token) await db.rpc("fx_release_refresh", { p_token: token });
  console.error(
    "Currency setup failed at " + stage + ". No credentials printed.",
  );
  process.exitCode = 1;
}
