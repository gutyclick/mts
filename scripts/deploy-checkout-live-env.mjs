import { spawnSync } from "node:child_process";
import { liveSecret } from "./lib/stripe-catalog.mjs";
process.loadEnvFile(".env.local");
try {
  liveSecret(process.env.STRIPE_LIVE_SECRET_KEY);
  if (
    !/^pk_live_[a-zA-Z0-9]{16,}$/.test(
      process.env.STRIPE_LIVE_PUBLISHABLE_KEY ?? "",
    ) ||
    !/^whsec_/.test(process.env.STRIPE_LIVE_WEBHOOK_SECRET ?? "") ||
    !/^sb_secret_/.test(process.env.SUPABASE_CHECKOUT_SECRET_KEY ?? "") ||
    (process.env.CHECKOUT_REQUEST_SECRET?.length ?? 0) < 32 ||
    process.env.FULFILLMENT_ENABLED !== "true"
  )
    throw new Error("Incomplete production configuration");
  const values = [
    ...[
      "STRIPE_LIVE_SECRET_KEY",
      "STRIPE_LIVE_PUBLISHABLE_KEY",
      "STRIPE_LIVE_WEBHOOK_SECRET",
      "SUPABASE_CHECKOUT_SECRET_KEY",
      "CHECKOUT_REQUEST_SECRET",
    ].map((name) => [name, process.env[name]]),
    ["CHECKOUT_SITE_URL", "https://www.mytripsim.com"],
    ["STRIPE_LIVE_CHECKOUT_ENABLED", "true"],
    ["STRIPE_TEST_CHECKOUT_ENABLED", "false"],
    ["CHECKOUT_PAYMENT_MODE", "live"],
  ];
  for (const [name, value] of values) {
    const result = spawnSync(
      process.env.ComSpec || "cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        `npx.cmd --yes vercel env add ${name} --environment production --sensitive --force --yes --project mts --scope guzzfirec-1094s-projects`,
      ],
      {
        input: value,
        encoding: "utf8",
        maxBuffer: 1024 * 1024,
        windowsHide: true,
      },
    );
    if (result.status !== 0) throw new Error("Environment deployment failed");
    console.log(`${name}: configured securely; value not printed.`);
  }
  console.log(
    "Production payment environment configured. A new deployment is required. No payment or provider purchase was made.",
  );
} catch {
  console.error("Production environment setup failed. No credentials printed.");
  process.exitCode = 1;
}
