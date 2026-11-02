# Inline checkout

Payment fields now render on the initial checkout form using Stripe deferred
Elements. No order or legal acceptance is created merely by rendering the fields.
The server creates the Checkout Session only after submission with the required
terms, compatibility confirmation and validated customer details.

The browser collects a Stripe PaymentMethod, creates the existing protected
session, verifies its mode, currency and exact minor-unit total, and confirms it
using the Checkout SDK. Fulfillment remains driven by the existing webhook.
The existing abandonment timer starts after an order has been prepared.

Payment methods use Stripe's automatic eligibility and Dashboard configuration.
Express buttons preserve Stripe branding. No client can display every method on
every device: wallet setup, country, currency and Stripe eligibility still apply.

The form blocks confirmation without consent. Express checkout also checks native
form validity. API failures report failure to the wallet. A changed cart invalidates
an in-flight confirmation before Stripe is called.

## Verification

- TypeScript and scoped ESLint passed.
- 12 mocked/security tests passed: inline confirmation, wallets, server consent,
  price verification, idempotency and abandoned payment holds.
- Production build passed using `npx.cmd next build --webpack`.
- Default Turbopack build encountered a local child-process failure.
- ChatGPT browser review verified real Stripe fields before consent, a disabled
  Pay button, automatic method availability and no horizontal overflow at 320,
  390 and 1440 pixels. Local Stripe configuration uses test mode.
- No real payment was submitted. Confirmation and failure paths were tested
  with mocks, not a real wallet or real eSIM provisioning.

After release, verify the production form and live-mode configuration without
submitting a charge. An actual transaction remains a customer acceptance check.
Do not issue real eSIMs for automated tests.
