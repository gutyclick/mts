# B2B — quotes, payments and delivery

## Operator workflow

1. Create company access in **Administration → B2B companies**. Business signup remains closed.
2. The company creates a trip and submits a fixed-plan request. Package trips request one eSIM per traveler; individual-sale trips can request fewer. Initial issuance limit: 1,000 per order.
3. Open **B2B orders and rates** on www. Configure whole-USD global plan rates, optional company overrides, bank instructions and enabled methods. No prices or bank details are invented or copied automatically from retail.
4. Publish the quote. An optional unit override applies only to that order. Enter actual applicable tax separately; the application does not determine tax liability. Publishing approves the request but never charges or issues. Paid snapshots and old expired quotes remain immutable.
5. The owner or finance user pays from the trip. Stripe uses its eligible dynamic payment methods. Signed server events verify payment; a browser return does not. Transfer references are notices only: an MFA administrator must verify the exact received amount and unique bank reference.
6. After verified **live** funds, an administrator authorizes issuance. Each unit has a permanent provider purchase ID, isolated retry state and fenced lease. Test Stripe funds cannot issue real eSIMs. Failed units require investigation; never create replacement purchase IDs for uncertain purchases.
7. Owner/coordinator can download ready individual SVG installation cards or a ZIP. Finance users cannot obtain QR credentials. Files are generated on demand behind authentication, with no public object URLs. Partial-ready downloads are allowed; activation is never inferred from a download.
8. Once every unit is ready, **Notify delivery** queues one email to the verified requesting owner/coordinator, falling back to a verified company owner. It links to the authenticated trip and contains no QR credentials. It does not email every traveler. Delivery acceptance is not proof of inbox delivery.

## Financial and safety rules

- USD-only B2B MVP. Integer cents and PostgreSQL exact numeric arithmetic; unit prices are whole USD.
- Fresh verified wholesale costs (15-minute limit), current published availability, approved modality and identical provider binding are required before accepting payment and authorizing issuance.
- Contribution must remain at least 20% of the pretax subtotal after wholesale, fees and configured reserves. Stripe reserve: 4.4% + USD 0.30. Yappy requires its actual contract fee; no guessed fee. No automatic consumer coupons, SimCoins or affiliate commissions.
- Paid orders, retail order history, retail selling prices and recorded wholesale values are never rewritten by B2B quote management. Refreshing verified provider costs uses the existing read-only provider catalog refresh.
- One active payment attempt per order. Unknown payment results block competing methods. An abandoned browser does not cancel a payment. Stripe expires its session after 35 minutes; late/signed confirmations reconcile the existing attempt. Uncertain creation older than 20 minutes needs investigation, not a new charge.
- Expired unpaid quotes can be republished only after pending/uncertain payment attempts are resolved. Renewal creates a new quote ID and preserves the old quote.
- A Stripe refund event places the B2B order in review and stops future claims/downloads. It does not reverse an already issued carrier profile, nor implement a new B2B refund execution UI.

## Configuration and rollout

- `B2B_ISSUANCE_ENABLED=false` by default. Enable only in the server environment after verification; the independent administrator `issuance_enabled` switch also defaults off. Both gates are required.
- `B2B_YAPPY_ENABLED=false` by default. Run `npm.cmd run yappy:configure -- --live` locally when the merchant button is configured for `https://portal.mytripsim.com`. Credentials remain in ignored `.env.local`; production requires scoped server-side environment upload. Never paste them into chat or Git.
- Yappy's official web component and server HMAC IPN adapter are implemented, but credentialed sandbox/live verification remains required before enabling the flag and admin switch. The browser's success event never marks an order paid. A retry does not create a replacement Yappy order while the original result is uncertain.
- `node scripts/configure-business-stripe-webhook.mjs` previews whether `charge.refunded` is subscribed; `--apply` only adds that event, preserving existing endpoint events. No endpoint/key rotation.
- `SUPABASE_CLI_PATH` must point to the installed CLI. `node scripts/setup-business-commerce.mjs --preflight` compiles additive migrations and runs rollback-only synthetic security/lifecycle fixtures. `--apply` installs schema only after those pass and rolls fixtures back before commit. `--check` reports installation.
- Separate `mts-b2b-commercial` cron uses the existing vault HMAC infrastructure and separate authenticated HTTP executions for units and notifications. It does no work while the administrator issuance switch is off and does not alter the retail scheduler.
- Outbox retries preserve the same Resend idempotency key; after 23 hours of uncertainty or bounded failures the job stops for review. Do not reset its ID to resend blindly. Delivery/bounce reporting for this new email category is not yet shown in the B2B panel.

## Verification and remaining acceptance

Offline tests cover money, ZIP integrity, Yappy schemas/signatures, Stripe snapshot mismatch, roles/MFA/tenant isolation, provider purchase/allocation retries and notification outbox leases. PostgreSQL rollback fixtures verify service-only writes, immutable money, stale costs, margin, duplicate attempts, competing transfer, live-payment provenance and refund holds. No real charge, eSIM purchase or email is part of automated checks.

Before commercial enablement: enter actual B2B rates and bank instructions, verify Stripe payment options, run a separately authorized end-to-end order, and complete credentialed Yappy checks. Traveler assignment, resale tracking, provider-confirmed activation counts, tax invoicing and bulk recipient emailing are subsequent capabilities, not claimed as implemented.

Official references: [Yappy integration](https://www.yappy.com.pa/comercial/desarrolladores/boton-de-pago-yappy-nueva-integracion/), [Stripe payment methods](https://docs.stripe.com/payments/checkout/payment-methods).
