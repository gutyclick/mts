# MyTripSim Business — accounts, trips and requests

## Operating scope

The portal now supports verified account access, administrator-created companies and administrator-assigned memberships, durable trips, real catalog plan requests and administrative review. It **does not charge, quote a final B2B price, issue eSIMs, send invitation emails, create traveler records or deliver QR codes** in this phase. Approval records commercial review only. Assignment/delivery/activation counters remain zero until their actual integrations exist.

## How to use it

1. A platform administrator opens `/es/admin/companies` or `/en/admin/companies` on **www**, completes existing admin MFA and chooses **Create company**. Enter the company name and the email of an existing verified MyTripSim account. No password is changed and no Auth account is silently created or confirmed.
2. The administrator enables additional users from the company card, choosing owner/coordinator/finance. Company creation and access assignment are idempotent, audited and service-only.
3. Users sign in at `https://portal.mytripsim.com/es` or `/en`. There is no signup link, application form or invitation acceptance. Accounts without an active membership see an administrator-managed-access notice. Existing TOTP MFA is enforced; password recovery remains available.
4. Owners/coordinators create trips with destination, dates, group size and model. The package model requests one eSIM per traveler; individual sales can request fewer. The plan must be a currently requestable fixed catalog SKU covering all trip dates. Exact plan IDs, names, capacity and duration are snapshotted.
5. Submitting saves a request in the protected administrator queue. The administrator approves it or requests changes with a visible note. Stale versions fail rather than overwriting a newer review. Changes can be resubmitted with a new attempt ID. Approved requests never call Stripe, eSIM Access or Resend.
6. Users belonging to several companies can switch company in **Team**; a full navigation prevents stale workspace data being reused. Owners can remove non-owner members. Pending invitations matching the removed user's email are revoked in the same transaction.

## Roles

| Capability                            | Owner | Coordinator | Finance |
| ------------------------------------- | ----- | ----------- | ------- |
| Read company trips and request status | Yes   | Yes         | Yes     |
| Create trips and submit requests      | Yes   | Yes         | No      |
| Create companies / add new members    | No    | No          | No      |
| Read full member email list           | Yes   | No          | No      |
| Approve company/order requests        | No    | No          | No      |

Only existing platform administrators with verified MFA can create companies, assign members, review requests or suspend/restore company access. Ordinary retail accounts, user metadata, supplied role names and company IDs do not grant company access. Suspension is checked on the next request. A revoked session cannot reuse an old invitation to regain membership.

## Security and persistence

Additive migrations: `20261105000100_business_portal.sql` and `20261105000200_business_admin_only.sql`. The second disables/revokes public application, invitation creation and acceptance. Historical application/invitation rows are retained for audit, not reused to grant access. Legacy approval RPCs are inaccessible even to service-role callers.

Tables: `b2b_organizations`, `b2b_memberships`, `b2b_applications`, `b2b_invitations`, `b2b_trips`, `b2b_order_requests`, `b2b_audit_logs`, `b2b_auth_limits`.

- Authenticated user RPCs derive identity from `auth.uid()`, require confirmed email, enforce existing MFA and check active membership/role. They use RLS; direct authenticated table mutations are denied.
- Administrator RPCs are service-only and verify actual admin membership; HTTP routes additionally require existing admin session/MFA and same-origin writes.
- JSON schemas reject supplied actor IDs, computed fulfillment, client prices and unknown keys. JSON body reads are bounded to 8 KiB, including streamed bodies. Login attempts use database throttles keyed by HMAC, without storing raw IPs or passwords.
- Trip/request replay uses UUID attempt IDs, row locks and version checks, including explicit SQL NULL rejection. No historic retail order, amount, cost or catalog price is changed.
- Audit is append-only through application operations; no admin history editing endpoint exists. Service-role UPDATE/DELETE/TRUNCATE on the audit table is revoked.
- Company-only support is loaded from server environment variables only after active membership is established. Public login/access-notice pages and JavaScript bundles contain no private contact values. Local setup input remains outside Git at `private-data/business-portal/contact.json`.

## Host separation

The portal uses its own route tree under `src/app/portal`. Exact-host requests for `portal.mytripsim.com` are rewritten there; `/portal/es` and `/portal/en` on www also enforce company access. The portal mounts no retail SiteFrame, cart or optional advertising bootstrap. It exposes only its `/api/portal` endpoints; storefront checkout/admin APIs remain blocked on that host. Platform administration remains on **www**.

Surface/forwarded-host hints select presentation only, never authorization. Cookies stay host-only. All portal pages/API responses are private/no-store/noindex. Its robots file disallows crawling and it has no storefront sitemap. Do not submit portal URLs to Search Console.

## Setup and checks

Set `SUPABASE_CLI_PATH` to the installed CLI binary (never print credentials).

- `node scripts/setup-business.mjs --preflight`: create schema inside a transaction, run synthetic tenant/RLS/invitation/MFA/idempotency fixtures and roll everything back.
- `node scripts/setup-business.mjs --apply`: install the additive schema after the same tests pass; synthetic auth/company records are rolled back before committing schema changes.
- `node scripts/setup-business.mjs --test`: rerun the rollback-only tests against the installed schema.
- `node scripts/setup-business.mjs --check`: report whether installed, without returning personal rows.
- `node scripts/configure-business-contact.mjs`: read the private local support input and write only `B2B_SUPPORT_EMAIL` / `B2B_SUPPORT_WHATSAPP` to ignored `.env.local`.
- Add `--deploy` with `VERCEL_CLI_PATH` to upload those **two values only** to Vercel as sensitive server variables. No production secrets are downloaded; values never appear in command arguments or output.
- `node --experimental-strip-types --test tests/business*.test.mjs tests/portal.test.mjs`: validation, endpoint, identity, MFA, rate, origin, privacy and domain tests, using mocks for authentication responses.
- `node scripts/test-portal-web.mjs`: read-only local HTTP smoke checks for anonymous ES/EN access, no fixture/contact exposure, protected APIs and storefront separation. Default port 3005; override `PORTAL_TEST_URL` when checking compiled mode.

Browser runtime initialization currently fails (`failed to write kernel assets`, OS error 3). HTTP/source/SQL tests are not a substitute for interactive mobile/browser acceptance; do not claim that review has been performed.

## Next commercial phase

Agree B2B pricing/taxes/payment or credit policy, quote snapshots and contract conditions before linking approval to issuance. Then integrate existing idempotent Stripe/eSIM Access fulfillment behind explicit payment/credit gates, add recipient records and audit-protected QR delivery/ZIP downloads, and display provider-confirmed activation. Add administrator-triggered account provisioning/notifications with delivery tracking when authorized. Removing copy alone must never activate issuance.
