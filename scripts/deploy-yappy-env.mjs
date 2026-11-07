import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import {
  yappyConfig,
  validateYappyMerchant,
} from "../src/lib/integrations/yappy.ts";
import { retailYappySettings } from "../src/lib/payments/yappy-policy.ts";
process.loadEnvFile(".env.local");
try {
  const args = process.argv.slice(2),
    site = args.includes("--retail") ? "retail" : "business";
  if (args.some((a) => !["--retail", "--business", "--enable"].includes(a)))
    throw Error("mode");
  const config = yappyConfig(process.env, true, site);
  if (!config) throw Error("configuration");
  await validateYappyMerchant(config);
  const enabled = args.includes("--enable");
  if (site === "retail") {
    const db = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_CHECKOUT_SECRET_KEY,
      { auth: { persistSession: false } },
    );
    const check = await db
      .from("checkout_yappy_attempts")
      .select("order_id", { head: true, count: "exact" })
      .limit(0);
    if (check.error) throw Error("migration_required");
    const refunds = await db
      .from("checkout_yappy_refund_receipts")
      .select("refund_id", { head: true, count: "exact" })
      .limit(0);
    if (refunds.error) throw Error("refund_migration_required");
    if (
      enabled &&
      !retailYappySettings(
        {
          ...process.env,
          YAPPY_RETAIL_ENABLED: "true",
          YAPPY_RETAIL_PERSISTENCE_READY: "true",
        },
        true,
      )
    )
      throw Error("confirmed_fees_required");
  }
  const prefix = `YAPPY_${site.toUpperCase()}_`;
  const values = [
    [`${prefix}LIVE_MERCHANT_ID`, config.merchantId],
    [`${prefix}LIVE_SECRET`, config.secret],
    [`${prefix}DOMAIN`, config.domain],
    [
      site === "retail" ? "YAPPY_RETAIL_ENABLED" : "B2B_YAPPY_ENABLED",
      String(enabled),
    ],
  ];
  if (site === "retail") {
    values.push(["YAPPY_RETAIL_PERSISTENCE_READY", "true"]);
    for (const key of [
      "YAPPY_RETAIL_FEE_BPS",
      "YAPPY_RETAIL_FIXED_CENTS",
      "YAPPY_RETAIL_FEES_CONFIRMED",
    ])
      if (process.env[key] !== undefined) values.push([key, process.env[key]]);
  }
  for (const [key, value] of values) {
    const r = spawnSync(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", `npx.cmd vercel env add ${key} production --force`],
      {
        input: value,
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 1024 * 1024,
      },
    );
    if (r.status !== 0) throw Error("environment_write");
  }
  console.log(
    JSON.stringify({
      site,
      domain: config.domain,
      enabled,
      redeployRequired: true,
      paymentCreated: false,
    }),
  );
} catch {
  console.error(
    "Yappy deployment configuration stopped. Verify credentials, migration and confirmed fees; no keys printed or payments created.",
  );
  process.exitCode = 1;
}
