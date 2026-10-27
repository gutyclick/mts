# Support chat: precise recommendations and reliable sends

- SIM keeps the existing gpt-5-nano model and restricted, non-stored structured responses.
- Published catalog plans provide allowance, validity, variant, networks and retail prices. Wholesale costs and activation credentials never enter recommendation context.
- Plan links are resolved by the server from allowed IDs, with at most three cards. Simple allowance/duration purchase requests use a catalog-derived recommendation; longer validity can cover a shorter trip. Other questions retain grounded AI explanations.
- Automatic FAQ reference links are hidden. Relevant plan cards remain available with the current-plan-page CTA.
- Sending shows the customer message immediately, then a typing indicator. A synchronous send guard, stable request ID, bounded timeout, ID-based message merge and refresh revision prevent duplicate sends and stale polling from replacing newer messages. Enter sends; Shift+Enter adds a line.
- Existing conversation ownership, quotas, ticket escalation, inactivity closure and rating are preserved. No database migration.

Validation: 12 focused tests passed; TypeScript and focused ESLint passed. Real nano inference with synthetic Japan trip requirements confirmed that IDs resolve to published plans; exact-duration wording was then replaced with a catalog-derived answer for straightforward purchase requests. No payment, eSIM issuance or customer email was triggered. Local Turbopack process startup failed; Webpack production build used as fallback.
