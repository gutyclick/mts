# Business portal implementation plan

**Goal:** Implement the approved travel-first B2B visual prototype inside the existing application.

**Architecture:** A separate `/portal` route tree bypasses the retail locale layout. Exact-host routing maps `portal.mytripsim.com` to this tree. Fictional examples and browser-session drafts are isolated from customer authentication, orders, payment and provisioning APIs.

**Tech stack:** Existing Next.js App Router, React, TypeScript, Lucide and brand fonts/assets. No additional dependencies or database migrations.

## Approved design

The unit of organization is a trip: destination, departure/return, group size, owner and individual-sale/package modality. Counts distinguish travelers, assigned, delivered and provider-confirmed activation. The prototype must visibly say that its data and approval actions are examples, not actual sales or provisioning.

Palette: brand blue #126de8, ink #122139, orange #ff8a3d, mist #f4f8fc, white #ffffff, success #168363. Existing Jakarta headings and Inter body/data, tabular numerals. Compact desktop sidebar and mobile bottom navigation. Signature: a trip boarding-pass summary with its departure date and four-step group progress. Keep a single clear primary action per screen.

Screens: overview, trips/search, new-trip form, trip detail with travelers/orders, eSIM request and administrative-review preview. Team/billing/help communicate next steps without pretending functional invitations, invoices or WhatsApp without a configured number. ES/EN localization.

## Constraints

- No real customer data, database writes, payments, email, QR generation or eSIM issuance.
- No claim that delivered QR means activated eSIM.
- The confirmed business contact is private. Store it outside Git and do not expose it before real company authentication exists.
- Portal noindex and no retail analytics bootstrap; no public sitemap inclusion.
- Portal host cannot fall through into retail pages or retail APIs.
- Existing store, sessions and historical orders unchanged.
- Support keyboard, reduced motion and 390px/desktop layouts.

## Implementation steps

- [x] Add pure host-routing/model modules and focused tests; observe failure then pass.
- [x] Build bilingual portal components and fictional trip/request state; keep draft state in the current browser session only.
- [x] Integrate host rewriting and noindex/cache boundaries, preserving retail proxy/session behavior.
- [x] Check TypeScript, lint, focused routing/domain regressions and production build.
- [ ] Review mobile and desktop in browser. Blocked: both computer-use runtimes fail to initialize with `failed to write kernel assets` / OS error 3, including retry after reset. No screenshots or interactive device checks claimed.
- [x] Document scope and next steps. Do not activate B2B transactions.

Verification: 22 unit/regression tests passed. Read-only HTTP smoke tests passed for all 20 ES/EN screens, root/robots/logo, isolation of retail/admin/API paths and ordinary storefront in both dev and compiled production server. DNS CNAME resolves to the configured Vercel target. A fresh-context source review is run before release.

## Future commercial phase

Real organization membership/RLS, server-side requests, administrator authorization, payment/credit gates, idempotent fulfillment, recipient-scoped revocable delivery links and auditable downloads. Never interpret this prototype's review screen as administrator authorization.
