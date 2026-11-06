import { writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
process.loadEnvFile(".env.local");
const folder = "private-data/catalog-redesign";
mkdirSync(folder, { recursive: true });
try {
  const db = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_CHECKOUT_SECRET_KEY,
    { auth: { persistSession: false } },
  );
  const [settings, levels, coupons] = await Promise.all([
    db.from("simcoins_program_settings").select("*").eq("id", true).single(),
    db
      .from("simcoins_levels")
      .select("id,rate_bps,threshold_cents")
      .order("threshold_cents"),
    db
      .from("coupon_definitions")
      .select(
        "id,code,kind,value,minimum_cents,starts_at,ends_at,max_uses,max_uses_per_customer,active,archived",
      )
      .eq("active", true)
      .eq("archived", false),
  ]);
  if (settings.error || levels.error || coupons.error)
    throw Error("configuration_read");
  const finance = {
    observedAt: new Date().toISOString(),
    settings: settings.data,
    levels: levels.data,
    coupons: coupons.data,
    stripe: null,
  };
  try {
    const stripe = new Stripe(process.env.STRIPE_LIVE_SECRET_KEY, {
      maxNetworkRetries: 1,
      timeout: 15000,
    });
    const account = await stripe.accounts.retrieve();
    const transactions = [];
    let cursor;
    for (let page = 0; page < 10; page++) {
      const result = await stripe.balanceTransactions.list({
        limit: 100,
        created: { gte: Math.floor(Date.now() / 1000) - 90 * 86400 },
        ...(cursor ? { starting_after: cursor } : {}),
      });
      transactions.push(
        ...result.data.map((t) => ({
          type: t.type,
          currency: t.currency,
          amount: t.amount,
          fee: t.fee,
          net: t.net,
          created: t.created,
          exchangeRate: t.exchange_rate,
          feeCategory:
            t.type === "stripe_fee"
              ? ([
                  "radar",
                  "fraud",
                  "3d",
                  "tax",
                  "billing",
                  "invoice",
                  "screen",
                ].find((k) =>
                  (t.description ?? "").toLowerCase().includes(k),
                ) ?? "unclassified")
              : null,
        })),
      );
      if (!result.has_more) break;
      cursor = result.data.at(-1).id;
    }
    finance.stripe = {
      country: account.country,
      settlementCurrency: account.default_currency,
      transactions,
      windowDays: 90,
      truncated: transactions.length === 1000,
    };
  } catch {
    finance.stripe = { unavailable: true };
  }
  writeFileSync(`${folder}/finance.json`, JSON.stringify(finance, null, 2));
  console.log(
    `Read-only financial configuration saved privately; ${coupons.data.length} active coupon definitions. Stripe fee evidence ${finance.stripe.unavailable ? "unavailable" : "retrieved without customer details"}.`,
  );
} catch {
  console.error(
    "Financial snapshot failed; no secrets or customer data printed.",
  );
  process.exitCode = 1;
}
