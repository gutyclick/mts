import { spawnSync } from "node:child_process";
import { testSecret } from "./lib/stripe-catalog.mjs";
process.loadEnvFile(".env.local");
try {
  testSecret(process.env.STRIPE_TEST_SECRET_KEY);
  if (
    !process.env.SUPABASE_CHECKOUT_SECRET_KEY?.startsWith("sb_secret_") ||
    !process.env.STRIPE_TEST_WEBHOOK_SECRET?.startsWith("whsec_") ||
    (process.env.CHECKOUT_REQUEST_SECRET?.length ?? 0) < 32
  )
    throw new Error("Missing server configuration");
  const values = [
    ...[
      "STRIPE_TEST_SECRET_KEY",
      "SUPABASE_CHECKOUT_SECRET_KEY",
      "STRIPE_TEST_WEBHOOK_SECRET",
      "CHECKOUT_REQUEST_SECRET",
    ].map((name) => [name, process.env[name]]),
    ["CHECKOUT_SITE_URL", "https://www.mytripsim.com"],
    // Public sales remain disabled while the entire test journey is reviewed.
    ["STRIPE_TEST_CHECKOUT_ENABLED", "false"],
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
      { input: value, encoding: "utf8", maxBuffer: 1024 * 1024 },
    );
    if (result.status !== 0) throw new Error("Secret deployment failed");
    console.log(`${name}: configured securely; value not printed.`);
  }
  console.log(
    "Server test infrastructure configured. Public payments remain disabled; no preview or browser secrets added.",
  );
} catch {
  console.error("Checkout environment setup failed. No credentials printed.");
  process.exitCode = 1;
}
