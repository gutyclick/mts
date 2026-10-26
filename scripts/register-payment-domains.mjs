import Stripe from "stripe";
import { testSecret, liveSecret } from "./lib/stripe-catalog.mjs";
process.loadEnvFile(".env.local");
const live = process.argv.includes("--live");
try {
  const stripe = new Stripe(
    live
      ? liveSecret(process.env.STRIPE_LIVE_SECRET_KEY)
      : testSecret(process.env.STRIPE_TEST_SECRET_KEY),
    {
      maxNetworkRetries: 2,
      timeout: 20000,
    },
  );
  const existing = new Map();
  for await (const domain of stripe.paymentMethodDomains.list({ limit: 100 })) {
    if (domain.livemode !== live)
      throw new Error("Stripe environment mismatch");
    existing.set(domain.domain_name, domain);
  }
  for (const name of ["www.mytripsim.com", "mytripsim.com"]) {
    let domain = existing.get(name);
    if (!domain)
      domain = await stripe.paymentMethodDomains.create(
        { domain_name: name },
        { idempotencyKey: `mts_wallet_domain_${name}` },
      );
    if (!domain.enabled)
      domain = await stripe.paymentMethodDomains.update(domain.id, {
        enabled: true,
      });
    if (
      domain.apple_pay.status !== "active" ||
      domain.google_pay.status !== "active"
    )
      domain = await stripe.paymentMethodDomains.validate(domain.id);
    if (domain.livemode !== live)
      throw new Error("Stripe environment mismatch");
    console.log(
      JSON.stringify({
        domain: name,
        test: !live,
        enabled: domain.enabled,
        applePay: domain.apple_pay.status,
        googlePay: domain.google_pay.status,
        link: domain.link.status,
      }),
    );
    if (
      !domain.enabled ||
      domain.apple_pay.status !== "active" ||
      domain.google_pay.status !== "active"
    )
      throw new Error("Domain verification incomplete");
  }
} catch (error) {
  const code =
    typeof error?.code === "string" && /^[a-zA-Z0-9_]+$/.test(error.code)
      ? error.code
      : "configuration_or_domain_validation";
  console.error(
    `${live ? "Live" : "Test"} payment domain configuration failed (${code}). No credentials printed.`,
  );
  process.exitCode = 1;
}
