// Expand only the existing MyTripSim endpoint. No charges or refunds are created.
import Stripe from "stripe";
import { paymentEnvironment } from "../src/lib/payments/checkout-mode.ts";
process.loadEnvFile(".env.local");
try {
  for (const mode of ["live", "test"]) {
    const id =
      process.env[
        mode === "live" ? "STRIPE_LIVE_WEBHOOK_ID" : "STRIPE_TEST_WEBHOOK_ID"
      ];
    const config = paymentEnvironment(process.env, mode);
    if (!id || !config.secret) continue;
    if (!/^we_[A-Za-z0-9]+$/.test(id)) throw Error();
    const stripe = new Stripe(config.secret, {
        timeout: 15000,
        maxNetworkRetries: 1,
      }),
      endpoint = await stripe.webhookEndpoints.retrieve(id);
    if (
      endpoint.url !==
        "https://www.mytripsim.com/api/payments/stripe/webhook" ||
      endpoint.livemode !== (mode === "live")
    )
      throw Error();
    if (!endpoint.enabled_events.includes("*"))
      await stripe.webhookEndpoints.update(id, {
        enabled_events: [
          ...new Set([
            ...endpoint.enabled_events,
            "refund.created",
            "refund.updated",
            "refund.failed",
          ]),
        ],
      });
    console.log(
      `${mode}: refund lifecycle events enabled on the existing MyTripSim endpoint.`,
    );
  }
} catch {
  console.error("Refund webhook setup stopped. No credentials printed.");
  process.exitCode = 1;
}
