# Support chat: precise recommendations and reliable sends

- SIM keeps the existing gpt-5-nano model and restricted, non-stored structured responses.
- Published catalog plans provide allowance, validity, variant, networks and retail prices. Wholesale costs and activation credentials never enter recommendation context.
- Plan links are resolved by the server from allowed IDs, with at most three cards. Simple allowance/duration purchase requests use a catalog-derived recommendation; longer validity can cover a shorter trip. Other questions retain grounded AI explanations.
- Automatic FAQ reference links are hidden. Relevant plan cards remain available with the current-plan-page CTA.
- Sending shows the customer message immediately, then a typing indicator. A synchronous send guard, stable request ID, bounded timeout, ID-based message merge and refresh revision prevent duplicate sends and stale polling from replacing newer messages. Enter sends; Shift+Enter adds a line.
- Existing conversation ownership, quotas, ticket escalation, inactivity closure and rating are preserved. No database migration.

Validation: 12 focused tests passed; TypeScript and focused ESLint passed. Real nano inference with synthetic Japan trip requirements confirmed that IDs resolve to published plans; exact-duration wording was then replaced with a catalog-derived answer for straightforward purchase requests. No payment, eSIM issuance or customer email was triggered. Local Turbopack process startup failed; Webpack production build used as fallback.

Browser QA: Enter immediately displayed the outgoing bubble and typing state. A real Japan 10 GB / 20-day request returned a published 10 GB / 30-day IIJ card at USD 9. A subsequent roaming question sent successfully and preserved history. Closing the synthetic guest incident displayed the existing rating choices. A final server filter limits commercial cards to plan-related requests. No human ticket, email, payment or eSIM issuance was created.

Production release: ee41a67, Vercel dpl_CZz494rTnWGi6CPYTodM2d8mnme5, READY with www.mytripsim.com alias. Final typecheck and 12 focused support tests passed. Vercel production build succeeded.
