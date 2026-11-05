# Business accounts, trips and requests implementation plan

**Goal:** Connect the approved B2B prototype to verified Supabase identities, organization membership and durable requests without payment or issuance.

**Architecture:** Reuse host-only Supabase auth cookies. Customer operations run through authenticated RPCs using `auth.uid()` and RLS; administrator actions reuse existing admin membership plus MFA checks and service-only RPCs. The storefront's orders/payments remain untouched.

**Decisions:** Existing accounts sign in on the portal; registration/recovery use existing storefront flows. A verified user applies for company access; an administrator approves it and creates the owner membership. Owner-created invitations require acceptance by the exact verified recipient. Coordinators create trips/requests; finance reads only. Owner can revoke non-owner members. A suspended company loses access on the next server request. Contacts are server-only and disclosed only to active members.

## Scope

- Additive organizations, memberships, applications, invitations, trips, requests, audit and auth-throttle tables, strict RLS and RPC privileges.
- Server validates actual catalog plan IDs and destination; snapshots plan name/data/duration. No invented B2B prices or wholesale disclosure.
- Version checks, row locks and idempotency protect duplicate trip/request/review submissions.
- Pending/approved/changes states are commercial review only; approval never issues or charges.
- Protected administration at `/es/admin/companies` and `/en/admin/companies`.
- No public fixtures in signed-in workspaces. Empty states replace the example data.
- Contact config outside Git; production values added individually without pulling secrets.
- No real customer test purchases, no emails or eSIM issues in automated tests.

## Tasks

- [x] Failing validation/authorization tests; then schemas, RPCs and safe DTOs.
- [x] Transactional database preflight with two synthetic organizations; verify RLS, role restrictions, invalid state transitions, idempotency and unchanged retail records. Roll back all fixtures.
- [x] Portal session endpoints, auth throttling, membership checks and private support projection.
- [x] Real login/application/invitation screens and durable trip/request actions; protected admin approvals and member controls.
- [x] ES/EN copy and empty states; lint/TypeScript/build, route/API tests and independent source review.
- [x] Additive migration, isolated deployment, anonymous production isolation checks. Document browser-runtime limitations if unavailable.

Migration installed after rollback-only fixture tests passed. All synthetic auth/company records rolled back before schema commit. Existing retail orders unchanged. 27 focused security/regression tests passed; full lint and TypeScript passed; production build generated 612 pages successfully. Read-only HTTP checks for all 20 ES/EN routes passed in both dev and compiled mode. 42 browser JavaScript chunks checked: private support values absent. Independent review found two edge cases (NULL version and pending invitations after removal); both fixed, regression-tested and re-reviewed before installation. Browser runtime still fails to initialize (OS error 3), so no real-browser authenticated/mobile acceptance is claimed. No eSIMs issued, payments made or emails sent by these tests.

Published source commit `2a6bb5d` in ready deployment `dpl_91G1so5MGmZtYzFD7EhiQnEPQyAR`, aliased to portal/www. Production HTTP checks passed: ES/EN access and support/trip paths show login without fixture/private contact values; portal API and www admin API deny anonymous access (401); cross-origin auth mutation is denied (403); retail checkout API on portal is blocked (404); admin company page redirects to login; storefront/home checkout remain 200. Anonymous application test was rejected before any record creation. First real company owner still needs to sign in, apply and receive administrator approval; no company or membership was silently granted during deployment.
