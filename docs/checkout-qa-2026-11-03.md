# Checkout verification — 3 November 2026

## Scope and evidence

- Real browser, local test-mode checkout: guest with no optional statistics consent; Japan 500 MB/7 days; USD and EUR; coupon lookup, conditions and application. USD 3.00 became USD 2.85. EUR 2.68 became EUR 2.55 using the current quote and actual per-unit rounding.
- Responsive widths 390 and 320 CSS pixels: document content remains within the viewport. Currency change removes the previous discount and requires fresh review/application.
- Mocked actual Checkout component handlers: Spanish guest USD; English account EUR; Spanish account JPY; uncertain confirmation (throw or returned error), insufficient funds, blocked programmatic consent bypass, card/wallet retry gates, same attempt reuse and preserved cart.
- Delivery state tests: empty enqueue, partial expected quantity, ready, review with/without installation availability, email-only state, explicit not-ready override, test-only orders and bounded polling. No fake credentials or paid status is written to production.
- PGlite tests cover coupon minimums, dates, identities, shared rate limits, immutable historical estimates, refund exclusions, consent withdrawal, retention, admin/privacy restrictions, event deduplication and checkout maturity.
- TypeScript and scoped ESLint passed. Existing checkout, currency, hold, wallet, fulfillment, coupon and analytics regression tests passed.

## Production rollout verification

- Release commit `0b0d4a4` built successfully in Vercel and deployment `dpl_B8YQCc7RC3cN7Br6wGTbUeip4kWx` reached READY, aliased to `www.mytripsim.com`.
- Additive migrations `20261103000200_checkout_funnel.sql` and `20261103000300_coupon_insights.sql` passed preflight and installation checks and were applied.
- Authenticated production browser checks: sales analytics and coupon reports load successfully. GUZZ conditions and application on Japan 500 MB/7 days show USD 3.00 subtotal, USD 0.15 discount and USD 2.85 total. Checked mobile layout at 390 CSS pixels.
- No payment submitted, legal checkboxes left unchecked, no real eSIM issued. Removed the sole QA cart item afterwards, restoring the original empty cart, and reset the viewport override.
- Existing unrelated working-tree changes were excluded from the deployment archive.

## Financial and privacy interpretation

Coupon reports show booked USD reference sales and **estimated contribution**, using the immutable wholesale/fee snapshot. Orders with requested, pending or completed refunds are excluded conservatively and reported separately; this is not actual Stripe settlement or accounting profit.

Stage observations begin with this release and require statistics consent. They count short-lived sessions, not unique people or every attempt. Abandonment categories describe recorded activity; no browser-close event proves permanent abandonment. Existing collection/paid attribution has a 30-minute consent-session limit, documented in `checkout-measurement.md`.

## Physical-device follow-up

Apple Pay and Google Pay availability is determined by Stripe, currency, eligible device/browser, wallet setup and account/domain configuration. This audit verifies automatic method rendering and consent gates, not actual wallet authorization on physical iOS/Android hardware. No real card was charged and no eSIM was provisioned.

Implementation follows Stripe's documented error handling and decline guidance:
- https://docs.stripe.com/error-handling
- https://docs.stripe.com/declines/codes
