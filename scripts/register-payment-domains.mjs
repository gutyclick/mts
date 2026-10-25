import Stripe from "stripe";
import { testSecret } from "./lib/stripe-catalog.mjs";
process.loadEnvFile(".env.local");
try {
  const stripe = new Stripe(testSecret(process.env.STRIPE_TEST_SECRET_KEY), {
    maxNetworkRetries: 2,
    timeout: 20000,
  });
  const existing = new Map();
  for await (const domain of stripe.paymentMethodDomains.list({ limit: 100 })) {
    if (domain.livemode) throw new Error("Live mode rejected");
    existing.set(domain.domain_name, domain);
  }
  for (const name of ["www.mytripsim.com", "mytripsim.com"]) {
    let domain = existing.get(name);
    if (!domain)
      domain = await stripe.paymentMethodDomains.create(
        { domain_name: name },
        { idempotencyKey: `mts_test_wallet_domain_${name}` },
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
    if (domain.livemode) throw new Error("Live mode rejected");
    console.log(
      JSON.stringify({
        domain: name,
        test: true,
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
    `Test payment domain configuration failed (${code}). No credentials printed.`,
  );
  process.exitCode = 1;
}
