import { readFileSync, writeFileSync, renameSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
process.loadEnvFile(".env.local");
try {
  const action = process.argv[2];
  if (!["--deploy-env", "--start"].includes(action))
    throw new Error("Invalid action");
  let secret = process.env.CHECKOUT_EXPIRY_SECRET;
  if (!secret) {
    secret = randomBytes(32).toString("hex");
    const content = readFileSync(".env.local", "utf8");
    writeFileSync(
      ".env.local.tmp",
      `${content.trimEnd()}\nCHECKOUT_EXPIRY_SECRET=${JSON.stringify(secret)}\n`,
      { mode: 0o600 },
    );
    renameSync(".env.local.tmp", ".env.local");
  }
  if (!/^[a-f0-9]{64}$/.test(secret)) throw new Error("Invalid secret");
  if (action === "--deploy-env") {
    const result = spawnSync(
      process.env.ComSpec || "cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        "npx.cmd --yes vercel env add CHECKOUT_EXPIRY_SECRET --environment production --sensitive --force --yes --project mts --scope guzzfirec-1094s-projects",
      ],
      { input: secret, encoding: "utf8", maxBuffer: 1024 * 1024 },
    );
    if (result.status !== 0) throw new Error("Vercel configuration failed");
    console.log(
      "Expiry worker secret configured securely. Scheduler not started yet.",
    );
  } else {
    const db = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_CHECKOUT_SECRET_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await db.rpc("configure_checkout_expiry_worker", {
      p_token: secret,
    });
    if (error || data !== true)
      throw new Error("Scheduler configuration failed");
    console.log(
      "Checkout expiry scheduler enabled every 15 seconds. Empty runs do not call Vercel. Secret stored in Vault; no values printed.",
    );
  }
} catch {
  console.error("Expiry setup failed. No credentials printed.");
  process.exitCode = 1;
}
