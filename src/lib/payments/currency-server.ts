import "server-only";
import { fetchStripeRateSnapshot } from "./fx-rates";
import { after } from "next/server";
import { z } from "zod";
import { checkoutDatabase, paymentEnvironment } from "./checkout-server";
import { usdRate, type Currency } from "../currency";
const snapshotSchema = z.object({
  id: z.uuid(),
  rates: z.record(z.string(), z.string()),
  sampled_at: z.string(),
  created_at: z.string(),
  expires_at: z.string(),
});
export async function refreshCurrencyRates() {
  const db = checkoutDatabase(),
    claim = await db.rpc("fx_claim_refresh");
  if (claim.error) throw Error("Currency service unavailable");
  if (!claim.data) return;
  const token = z.uuid().parse(claim.data);
  try {
    const data = await fetchStripeRateSnapshot(
      paymentEnvironment(process.env, "live").secret,
    );
    const saved = await db.rpc("fx_store_snapshot", {
      p_token: token,
      p_provider: data.provider,
      p_sampled: data.sampledAt,
      p_rates: data.rates,
    });
    if (saved.error) throw Error();
  } catch {
    await db.rpc("fx_release_refresh", { p_token: token });
    throw Error("Currency service unavailable");
  }
}
async function latest() {
  const r = await checkoutDatabase()
    .from("fx_snapshots")
    .select("id,rates,sampled_at,created_at,expires_at")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (r.error) throw Error("Currency service unavailable");
  return r.data ? snapshotSchema.parse(r.data) : null;
}
export async function currencyQuote(currency: Currency) {
  if (currency === "USD")
    return {
      currency: "USD" as const,
      id: null,
      rate: usdRate,
      sampledAt: null,
      expiresAt: null,
    };
  let snapshot = await latest();
  if (!snapshot) {
    await refreshCurrencyRates();
    snapshot = await latest();
  }
  if (!snapshot) throw Error("Currency service unavailable");
  if (new Date(snapshot.created_at).getTime() < Date.now() - 3600000)
    try {
      after(async () => {
        try {
          await refreshCurrencyRates();
        } catch {
          /* Existing valid storefront prices remain available. */
        }
      });
    } catch {
      /* Refresh can wait for next request. */
    }
  const rate = snapshot.rates[currency];
  if (!/^\d{1,16}$/.test(rate)) throw Error("Currency rate unavailable");
  return {
    currency,
    id: snapshot.id,
    rate,
    sampledAt: snapshot.sampled_at,
    expiresAt: snapshot.expires_at,
  };
}
