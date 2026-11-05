# B2B pricing, payment and delivery implementation plan

**Approved choices:** Stripe, bank transfer and automatic Yappy Comercial; fixed B2B tariffs, with per-company and per-order adjustments. Only platform administrators create business accounts/access.

**Goal:** Make approval, payment and issuance distinct auditable actions, then let the company distribute purchased eSIMs efficiently.

**Lifecycle:** request → reviewed/priced → awaiting payment → payment verified → authorized issuance → provisioning (per-unit progress) → ready for distribution. Activation is separately reported by the provider, never inferred from QR downloads.

**Pricing:** Admin-managed global per-plan B2B tariff, optional company override, optional order override before publication. No automatic catalog repricing. USD MVP, integer-dollar unit prices, exact cents for totals/tax/fees. Immutable quote revisions and paid snapshots. Revalidate provider identity/cost and minimum contribution (20%) before allowing payment/release. Taxes, wholesale costs, estimated fees and variable reserves are accounted separately. B2B does not automatically participate in consumer coupons/SimCoins/affiliates.

**Payments:** Stripe uses eligible dynamic methods and signed webhook verification (never the success redirect). Transfer requires administrator verification of the actual amount/reference, not an uploaded receipt alone. Yappy uses the current official web component, server-created orders and verified IPN HMAC. Its eventSuccess is informational only. Credentials stay server-side. Uncertain/pending provider attempts block a second competing payment; expiration and retries preserve idempotency. Payment-method fees must be configured before exposing a method.

**Administration:** Configure tariffs/payment instructions, review/edit/publish quote, verify transfer, authorize issuance once funds are confirmed, monitor unit progress and retry only failed units, download ready QR files or send a single company notification. No button may charge or issue simply by approving a request.

**Delivery:** Isolate B2B fulfillment from retail per-unit email delivery. Reuse the provider API/allocation validation but maintain per-unit stable transaction IDs, leases and snapshots. One coordinator notification with a protected portal link; company downloads individual installation files or a ZIP on demand. Avoid 30 automatic emails for a 30-person trip. Optional recipient sharing must scope access to a single eSIM and be revocable.

**Dependencies:** User configures Yappy merchant ID/secret in their terminal; bank instructions and B2B rates are entered in protected admin UI. Do not invent account numbers, tariff values or tax treatment. Do not place real eSIM test purchases without a new explicit authorization. Transactional activation remains feature-gated until tests and required configuration are complete.

**Official references:** https://www.yappy.com.pa/comercial/desarrolladores/boton-de-pago-yappy-nueva-integracion/ and https://docs.stripe.com/payments/checkout/payment-methods.

- [x] Pure pricing/lifecycle and Yappy signature tests before implementation.
- [x] Additive quote/payment/fulfillment model with RLS, locking, idempotency and audit.
- [x] B2B tariffs and order-management admin UI plus company quote/payment view.
- [x] Stripe/Yappy callbacks, manual transfer verification, isolated issuance/delivery worker.
- [x] Mocked integrations and rollback-only DB tests, TypeScript/lint/build and source review.
- [x] Report configured vs blocked methods honestly before production activation (docs/business-commerce.md).
- [ ] Commercial enablement: actual B2B tariffs/bank instructions and separately authorized live acceptance order.
- [ ] Yappy credentials, contract fees and credentialed integration QA before enabling its flag.
