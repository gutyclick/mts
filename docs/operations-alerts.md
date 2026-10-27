# Operational monitoring

Recipient: **gustavo@mytripsim.com**. Public customer support remains **hello@mytripsim.com**.

The signed worker checks every five minutes. It detects live paid fulfillment units not delivered after ten minutes, delivery bounces/failures/complaints, delays exceeding fifteen minutes, provider balance below USD 20, and balance-query failures. Provider balance units are USD/10,000; an unknown balance is never treated as zero. QA/test orders are excluded.

Each unresolved incident has one notification with a stable payload and idempotency key. Retries stop before Resend's 24-hour idempotency window and after eight attempts; uncertain outcomes go to manual review. Notifications contain only a short order reference and the private admin link, never QR codes or customer addresses. A failed operational-alert email is marked for review in the panel without generating recursive alerts.

Open `/es/admin/operations` or `/en/admin/operations`. Membership and verified MFA are required. Acknowledging an alert records the action and stops pending notification attempts; it does not mark its cause as fixed. A healthy later check resolves the incident. No monitoring action cancels/refunds an order, purchases an eSIM or resends a customer's QR.

## Deployment order

1. `npm.cmd run test:operations` and `npm.cmd run test:admin:mfa` against the local production server. The integration test creates/removes only its own temporary user, sends no email and performs no financial transaction.
   For the complete native Server Action form flow, start a completed production build on port 3012 and run `npm.cmd run test:admin:mfa:forms` (or set `ADMIN_TEST_BASE` to another local port). It verifies that enrollment actually renders the QR, a wrong code preserves verification, and successful verification persists cookies. Do not rebuild `.next` while this test server is running.
2. `npm.cmd run operations:setup -- --prepare`: create a dedicated Resend webhook, immediately store its signing secret in ignored `.env.local`, leave it disabled until deployment. Existing endpoints are not overwritten if their secret is missing.
3. Apply the additive Supabase migration; it starts with monitoring disabled.
4. `npm.cmd run operations:setup -- --deploy-env`: store the signing secret and server-only enable flag in Vercel production.
5. Deploy and verify the unsigned webhook returns 400 and admin APIs return 401 to anonymous callers.
6. `npm.cmd run operations:setup -- --activate`: enable the approved recipient/threshold and five-minute cron, then enable the six delivery events. No test email is sent.

Do not print CLI webhook output: creation contains a secret. Never place any of these secrets in `NEXT_PUBLIC_*` variables or Git. Confirm actual delivered status of the first genuine operational alert; an accepted send alone does not prove inbox delivery.

## Admin MFA

The owner signs in normally and visits `/es/admin`. Existing AAL1 sessions are redirected to `/es/admin/security`. Scan the private QR with an authenticator, enter its six-digit code, then enter administration. Future AAL1 sessions require a new authenticator code. Do not send QR codes or OTPs to support or chat.

There is intentionally no public MFA bypass. If the owner loses the factor, use the authenticated Supabase recovery process after independently verifying ownership; never grant administrative membership based on an email/chat claim alone. Actual backup recovery remains a separate workstream, not covered by the database fixture tests.
