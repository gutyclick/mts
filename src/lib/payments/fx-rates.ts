import { z } from "zod";
import { currencies, rateFromStripeBase, usdRate } from "../currency.ts";
// Informational live quotes only. No customer data, rate lock or payment is sent.
export async function fetchStripeRateSnapshot(
  secret: string,
  transport: typeof fetch = fetch,
) {
  if (!/^(sk|rk)_live_[A-Za-z0-9]{16,}$/.test(secret))
    throw Error("Live informational rates required");
  const body = new URLSearchParams({
    to_currency: "usd",
    lock_duration: "none",
  });
  for (const currency of currencies)
    if (currency.code !== "USD")
      body.append("from_currencies[]", currency.code.toLowerCase());
  const response = await transport("https://api.stripe.com/v1/fx_quotes", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + secret,
      "Stripe-Version": "2025-07-30.preview",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw Error("FX provider unavailable");
  const data = z
    .object({
      id: z
        .string()
        .max(100)
        .regex(/^fxq_[A-Za-z0-9]+$/),
      created: z.number().finite(),
      lock_duration: z.literal("none"),
      to_currency: z.literal("usd"),
      rates: z.record(
        z.string(),
        z.object({
          rate_details: z.object({ base_rate: z.number().positive().finite() }),
        }),
      ),
    })
    .parse(await response.json());
  const rates: Record<string, string> = { USD: usdRate };
  for (const currency of currencies)
    if (currency.code !== "USD")
      rates[currency.code] = rateFromStripeBase(
        data.rates[currency.code.toLowerCase()]?.rate_details.base_rate,
      );
  return {
    provider: data.id,
    sampledAt: new Date(data.created * 1000).toISOString(),
    rates,
  };
}
