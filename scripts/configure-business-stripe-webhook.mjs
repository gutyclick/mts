import Stripe from "stripe";
process.loadEnvFile(".env.local");
const mode = process.argv.includes("--test") ? "TEST" : "LIVE";
try {
  const key = process.env[`STRIPE_${mode}_SECRET_KEY`],
    id = process.env[`STRIPE_${mode}_WEBHOOK_ID`];
  if (!key || !id?.startsWith("we_")) throw Error();
  const stripe = new Stripe(key, { maxNetworkRetries: 2, timeout: 15000 });
  const endpoint = await stripe.webhookEndpoints.retrieve(id);
  if (
    endpoint.url !== "https://www.mytripsim.com/api/payments/stripe/webhook" ||
    endpoint.livemode !== (mode === "LIVE")
  )
    throw Error();
  const present =
    endpoint.enabled_events.includes("*") ||
    endpoint.enabled_events.includes("charge.refunded");
  if (!present && process.argv.includes("--apply"))
    await stripe.webhookEndpoints.update(id, {
      enabled_events: [...endpoint.enabled_events, "charge.refunded"],
    });
  console.log(
    present
      ? "B2B refund notification already subscribed."
      : process.argv.includes("--apply")
        ? "B2B refund notification added; existing events preserved."
        : "B2B refund notification needs subscription (--apply). No changes made.",
  );
} catch {
  console.error(
    "Stripe webhook setup stopped; no keys or endpoint details printed.",
  );
  process.exitCode = 1;
}
