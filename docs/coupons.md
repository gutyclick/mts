# Checkout coupons

The existing checkout uses Stripe Elements and its protected order preparation.
Coupons are managed by MyTripSim, not a second Stripe catalog. After a coupon is
validated the server prepares discounted unit prices through the same Stripe
line-item binding and webhook verification used for ordinary orders.

## Customer experience

- Two clear sections: contact and payment. Optional recipient and marketing
  controls remain available. The code field is always visible in a highlighted
  blue panel near the end of checkout, above the legal confirmations.
- One coupon per order. Coupon orders neither earn nor redeem SimCoins.
- Enter a code and choose **Apply**. Conditions are validated on the server and
  are not displayed as a separate checkout panel. Apply checks current verified
  costs, availability, limits and contribution before showing the actual saving.
- Coupons require an authenticated MyTripSim account with a confirmed email.
  Guest checkout remains available without coupons. Localized sign-in and
  registration links return to checkout while the browser keeps its cart.
- Both the details endpoint and quote/payment RPCs enforce account eligibility.
  Old guest quotes and cross-account quotes cannot prepare new payments. Historic
  guest paid reservations still finalize, and their email-based usage still counts.
  Details lookup and quote attempts retain the same persistent rate bucket;
  there is no public list of available codes or supplier costs.
- Percentage values use basis points; fixed values and minimums use USD cents.
  Fixed offers convert with the same trusted FX snapshot as the cart.
- Equal per-unit discounts round down in USD cents, then the net unit amount is
  converted and rounded in the chosen currency. The displayed saving is the
  actual result, which may differ slightly from the nominal fixed amount.
- A quote lasts ten minutes and does not reserve a use until payment preparation.
  A changed cart, buyer, FX quote, expired offer or changed coupon invalidates it.

## Administration and safety

`/es/admin/coupons` and `/en/admin/coupons` require the existing verified admin
session and MFA. The UI supports creation, changes to value, validity, caps and
minimum order; pause and archive; generated codes; filters and amount previews.
Codes remain immutable and cannot be reused after archival. Archiving removes
availability for new purchases while preserving historical usage.

Usage is capped across paid orders plus pending reservations. The database locks
the coupon during reservation, and payment-status transitions consume or release
the use idempotently. Pending payment retries retain their reservation; closing
the browser alone does not count as a failed payment. Existing expiry workers
reconcile abandoned sessions before release. A refunded purchase still counts as
a used promotion, preventing repeated buy/refund reuse.

Individual caps combine verified user ID and a keyed hash of billing email.
Legacy guest usage remains email-based; it does not prove real-world identity. Delivery to
another recipient does not grant another coupon allowance. Invalid code attempts
are rate-limited by a private IP hash. Raw email and IP never appear in coupon
tables or public errors.

Margin is checked at quote and again at preparation using current verified
wholesale costs, actual currency rounding, conservative Stripe fees (4.4% or
5.4% with FX plus USD 0.30), an 8% affiliate reserve, other configured reserves
and at least 20% contribution. Coupon campaigns can exceed the ordinary 5%
promotion reference only when this profitability check passes. Prices are never
raised to fund a coupon. Missing or stale costs fail closed.

The provider refresh verifies all published fixed-plan identities from a single
supplier catalog response, with paginated reads and batched private cost writes.
This avoids rejecting the next cart during the shared one-minute refresh cooldown.
Concurrent checkouts re-read persisted costs for up to 5.5 seconds. The refresh
lease is independent of SimCoins activation; discounts do not enable rewards.
No unmatched or unverified price is treated as a verified cost. Customer messages
distinguish temporary verification failures from margin-based ineligibility.

Order snapshots are immutable. Editing an offer never rewrites historical order
amounts. Reservations already attached to an order keep their original terms.
All tables have RLS and all financial RPCs are service-role-only. Admin mutations
record actor, idempotency reference and before/after values.

Per-offer reporting counts only live orders whose current status is paid. Sales
are the immutable post-discount USD checkout reference, not actual Stripe
settlement receipts. Contribution is estimated from saved conservative cash,
wholesale and fee units (10,000 units per USD); it is never net profit. Missing
estimates show a dash and coverage count. Orders with any requested, ongoing or
successful refund, including partial refunds, are excluded entirely and their
count and original USD sales value are shown. Failed/rejected refund requests
do not exclude an order. Supplier cost changes and edits to offers cannot alter
these historical figures. Lifetime usage/discount summary still includes refunded
redemptions, consistent with the nonrefundable usage cap.

## Operations

Apply the additive migrations `20261101000100_checkout_coupons.sql`,
`20261101000200_coupon_audit_immutable.sql`, `20261101000300_coupon_live_mode.sql`
`20261103000100_promotion_cost_refresh.sql` and
`20261103000300_coupon_insights.sql`
before deploying the new UI. They create no live offers and change no existing orders. The operator
script `scripts/setup-coupons.mjs --apply` verifies the linked Supabase project
before applying only the missing coupon migrations. `--check` checks installation without writes.
Stripe test orders cannot reserve or consume a commercial coupon.

Tests: `node --experimental-strip-types --test tests/coupons-*.test.mjs`, plus
checkout, currency, SimCoins, hold, refund and fulfillment regression suites.
Tests use PGlite and mocks; no real payment or eSIM is created.
