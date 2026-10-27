# Reviewed refunds

Open **Administration → Refunds**, or **Review refund** on a paid order. Administrative membership and AAL2 are checked for every page/API call.

1. Select the purchased eSIM units and enter an internal reason. The server calculates the refund from immutable original unit amounts; the browser cannot set an amount. A request reserves its units against duplicate requests, but does not move money.
2. Review the original payment, eligibility and supplier status. Approval waits if a fulfillment lease is active. Explicitly acknowledge that a Stripe refund does not cancel/deactivate an issued supplier eSIM.
3. Confirm the displayed amount. Approved units are held out of fulfillment while payment reconciliation is uncertain/pending, and remain held if successfully refunded. Failed/rejected requests release reservations when the outcome is definitive. An already issued eSIM may remain usable until separately handled with the provider; this is not supplier cancellation.
4. Read Stripe's actual result. **Pending** is not a completed refund. Signed refund lifecycle events reconcile automatically; **Check Stripe** reconciles or retries the same approved operation safely. The audit shows requests, authorizations, attempts and outcomes.

Refunds go to the original payment method. The existing overview reports **gross sales before refunds**, not net revenue. No refund/customer receipt email is promised by this panel; Stripe's own receipt settings remain separate.

## Unknown outcomes and manual review

Each approved request has one stable Stripe idempotency key and immutable payload. Before creating anything, the server checks captured amount, environment, currency, disputes, existing refunds and remaining funds. An existing matching refund is reconciled instead of created again. External/unallocated refunds or inconsistent snapshots require review. A new creation is never attempted after 23 hours or eight attempts; an existing operation may still be reconciled. Do not manually invent another request/key to bypass this protection.

If a request needs review, inspect Stripe and the supplier before taking financial action. A network timeout is not proof of failure. Keep units held until the outcome is known. This version intentionally has no “ignore uncertainty and release” button. The current workflow refunds whole purchased units; discretionary partial-unit adjustments require individual handling in Stripe and are detected as external refunds on later checks.

Terminal Stripe progression takes precedence over out-of-order pending responses. Successful refunded units are excluded from overdue-delivery and delivery-email alerts. Pending/uncertain refunds still deserve attention while the customer has neither delivery nor a confirmed refund.

## Verification and release

- `npm.cmd run test:refunds`: isolated PGlite and simulated Stripe dispatch; no real monetary effects.
- Start a completed local production build on port3013, then `npm.cmd run test:refunds:integration`: creates only its own disposable user and Stripe-test order records, verifies 403/428/origin/strict amounts, creates a review request, reads ES/EN rendered pages and rejects it. It never approves/executes a refund or calls Stripe. It removes its fixtures.
- Apply migration `20261026000600_admin_refunds.sql`, deploy reviewed code, verify protected routes, then `npm.cmd run refunds:events` to add `refund.created`, `refund.updated`, `refund.failed` to the existing MyTripSim endpoints without dropping checkout events.
- No real refund is authorized merely by running tests or deploying this feature. Only the operator's explicit in-product confirmation initiates a live refund.

References: [Stripe refunds](https://docs.stripe.com/refunds), [Refund API](https://docs.stripe.com/api/refunds/create).
