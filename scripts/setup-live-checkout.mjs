// Operator command: credentials stay in memory or the ignored local environment file.
import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { catalogConfig } from "../src/lib/supabase/catalog-api.ts";
import { liveSecret } from "./lib/stripe-catalog.mjs";

process.loadEnvFile(".env.local");
function save(name, value) {
  let content = readFileSync(".env.local", "utf8");
  const line = `${name}=${JSON.stringify(value)}`;
  const pattern = new RegExp(`^${name}=.*$`, "m");
  content = pattern.test(content)
    ? content.replace(pattern, () => line)
    : `${content.trimEnd()}\n${line}\n`;
  writeFileSync(".env.local.tmp", content, { mode: 0o600 });
  renameSync(".env.local.tmp", ".env.local");
  process.env[name] = value;
}
let stage = "configuration";
try {
  const config = catalogConfig(process.env);
  if (!config) throw new Error("No catalog");
  const stripe = new Stripe(liveSecret(process.env.STRIPE_LIVE_SECRET_KEY), {
    maxNetworkRetries: 2,
    timeout: 20000,
  });
  stage = "live account verification";
  const account = await stripe.accounts.retrieve();
  if (!account.charges_enabled) throw new Error("Live account not activated");
  stage = "database authentication";
  if (!process.env.SUPABASE_CHECKOUT_SECRET_KEY) {
    const ref = new URL(config.url).hostname.split(".")[0];
    if (!/^[a-z]{20}$/.test(ref)) throw new Error("Invalid project");
    const result = spawnSync(
      process.env.ComSpec || "cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        `npx.cmd --yes supabase projects api-keys --project-ref ${ref} --reveal --output json`,
      ],
      { encoding: "utf8", maxBuffer: 1024 * 1024 },
    );
    if (result.status !== 0) throw new Error("CLI authentication required");
    const key = JSON.parse(result.stdout).find(
      (k) => k.type === "secret" && k.api_key.startsWith("sb_secret_"),
    )?.api_key;
    if (!key) throw new Error("Secret key missing");
    save("SUPABASE_CHECKOUT_SECRET_KEY", key);
  }
  if (!process.env.CHECKOUT_REQUEST_SECRET)
    save("CHECKOUT_REQUEST_SECRET", randomBytes(32).toString("hex"));
  const db = createClient(
    config.url,
    process.env.SUPABASE_CHECKOUT_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  stage = "live catalog verification";
  const bindings = JSON.parse(
    readFileSync("private-data/stripe/live-bindings.json", "utf8"),
  );
  const prices = new Map();
  for await (const price of stripe.prices.list({ limit: 100 }))
    prices.set(price.id, price);
  if (
    !bindings.length ||
    new Set(bindings.map((b) => b.planId)).size !== bindings.length
  )
    throw new Error("Invalid bindings");
  for (const binding of bindings) {
    const price = prices.get(binding.priceId);
    if (
      !price ||
      !price.livemode ||
      !price.active ||
      price.currency !== "usd" ||
      price.type !== "one_time" ||
      price.unit_amount !== binding.unitAmount ||
      price.product !== binding.productId ||
      price.metadata.mts_plan_id !== binding.planId
    )
      throw new Error("Catalog mismatch");
  }
  stage = "private catalog bindings";
  for (let offset = 0; offset < bindings.length; offset += 250) {
    const { error } = await db.from("stripe_catalog_prices").upsert(
      bindings.slice(offset, offset + 250).map((b) => ({
        plan_id: b.planId,
        product_id: b.productId,
        price_id: b.priceId,
        amount_cents: b.unitAmount,
        currency: "usd",
        livemode: true,
        updated_at: new Date().toISOString(),
      })),
      { onConflict: "plan_id,livemode" },
    );
    if (error) throw new Error("Binding persistence failed");
  }
  console.log(
    `${bindings.length} verified live price bindings stored in the private database table.`,
  );
  stage = "live webhook registration";
  const url = "https://www.mytripsim.com/api/payments/stripe/webhook";
  if (
    process.env.STRIPE_LIVE_WEBHOOK_ID &&
    process.env.STRIPE_LIVE_WEBHOOK_SECRET
  ) {
    const endpoint = await stripe.webhookEndpoints.retrieve(
      process.env.STRIPE_LIVE_WEBHOOK_ID,
    );
    if (
      !endpoint.livemode ||
      endpoint.url !== url ||
      endpoint.status !== "enabled"
    )
      throw new Error("Webhook mismatch");
  } else {
    for await (const endpoint of stripe.webhookEndpoints.list({ limit: 100 }))
      if (endpoint.url === url)
        throw new Error("Existing endpoint needs its signing secret");
    const endpoint = await stripe.webhookEndpoints.create({
      url,
      api_version: Stripe.API_VERSION,
      enabled_events: [
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.async_payment_failed",
        "checkout.session.expired",
      ],
      description: "MyTripSim Checkout confirmation",
      metadata: { mts_usage: "live_checkout" },
    });
    if (!endpoint.livemode || !endpoint.secret)
      throw new Error("Invalid webhook");
    save("STRIPE_LIVE_WEBHOOK_SECRET", endpoint.secret);
    save("STRIPE_LIVE_WEBHOOK_ID", endpoint.id);
  }

  console.log(
    "Live catalog and webhook configured. Checkout activation is a separate deployment step. No purchases were made.",
  );
} catch {
  console.error(
    `Live checkout setup failed at ${stage}. No credentials printed.`,
  );
  process.exitCode = 1;
}
