import { loadEnvFile } from "node:process";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import { catalogConfig } from "../src/lib/supabase/catalog-api.ts";
loadEnvFile(".env.local");
try {
  const config = catalogConfig(process.env);
  if (!config) throw new Error("Missing catalog configuration");
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
  const secret = JSON.parse(result.stdout).find(
    (k) => k.type === "secret" && k.api_key.startsWith("sb_secret_"),
  )?.api_key;
  if (!secret) throw new Error("Worker authentication required");
  const prices = JSON.parse(
    readFileSync("src/data/retail-prices.json", "utf8"),
  );
  const client = createClient(config.url, secret, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.rpc("apply_retail_prices", {
    prices: Object.entries(prices).map(([plan_id, amount_cents]) => ({
      plan_id,
      amount_cents,
    })),
  });
  if (error || data !== Object.keys(prices).length)
    throw new Error("Retail update failed");
  console.log(
    `Synchronized ${data} final USD retail prices. No supplier costs were uploaded.`,
  );
} catch {
  console.error(
    "Retail synchronization failed. No credentials or private CSV columns were printed.",
  );
  process.exitCode = 1;
}
