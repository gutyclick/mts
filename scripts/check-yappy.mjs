import {
  yappyConfig,
  validateYappyMerchant,
} from "../src/lib/integrations/yappy.ts";
process.loadEnvFile(".env.local");
try {
  const site = process.argv.includes("--retail") ? "retail" : "business";
  const live = process.argv.includes("--live");
  const config = yappyConfig(process.env, live, site);
  if (!config) throw Error("configuration");
  await validateYappyMerchant(config);
  console.log(
    JSON.stringify({
      site,
      live,
      domain: config.domain,
      merchantAuthorization: true,
      paymentCreated: false,
      realIpnVerified: false,
    }),
  );
} catch {
  console.error(
    "Yappy verification failed. Check the selected site, credentials and domain; no credentials printed or payments created.",
  );
  process.exitCode = 1;
}
