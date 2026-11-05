# MyTripSim Business — visual foundation

## Scope

This first phase is a bilingual, navigable **prototype**, not an operating B2B order system. All seeded trips, references, sales and activation counts are fictional. Creating a trip, submitting a request or approving it changes only the React state of the currently open page session. Refreshing starts again with the examples. There are no new database tables, payment intents, emails, provider requests or generated QR codes.

## Addresses and separation

- Intended address: `https://portal.mytripsim.com/es` (also `/en`).
- Local inspection: `http://127.0.0.1:3005/portal/es`.
- `src/proxy.ts` rewrites exact portal-host requests into the separate `src/app/portal` tree. No retail SiteFrame, cart, support messenger or advertising consent bootstrap is mounted there.
- The existing storefront still uses its normal locale layout/session refresh. The portal-host retail/API paths respond 404; no checkout or admin API is exposed through this prototype host.
- Internal Next rewrites may normalize Host to localhost in development. The original forwarded host plus surface marker preserve clean portal links on that second pass. These are **presentation hints only**, never organization membership or administrative authorization.
- Portal pages return `private, no-store` and `noindex, nofollow`. The portal-host robots file disallows crawling; its sitemap is not the storefront sitemap. Do not add prototype URLs to Search Console.

## Screens

| Screen          | Spanish path                | English path             |
| --------------- | --------------------------- | ------------------------ |
| Overview        | `/es`                       | `/en`                    |
| Trips           | `/es/viajes`                | `/en/trips`              |
| New trip        | `/es/viajes/nuevo`          | `/en/trips/new`          |
| Trip detail     | `/es/viajes/{id}`           | `/en/trips/{id}`         |
| Request eSIMs   | `/es/viajes/{id}/solicitar` | `/en/trips/{id}/request` |
| Example review  | `/es/revision`              | `/en/review`             |
| Team roles      | `/es/equipo`                | `/en/team`               |
| Billing outline | `/es/facturacion`           | `/en/billing`            |
| Support outline | `/es/soporte`               | `/en/support`            |
| Access outline  | `/es/acceso`                | `/en/access`             |

Trip detail separates overview, travelers/eSIMs and orders. Traveler lists paginate by 50 after the first ten; their CSV export includes fictional references/status only. The package model requests one eSIM per traveler. Individual-sale requests can cover a subset. Deliveries and activations do not advance merely because a request is approved.

## Private business support

The owner's company-only support details are stored **locally and outside Git** in `private-data/business-portal/contact.json`. This file is not imported into the application or deployment. The preview deliberately exposes neither the number nor the business email.

In the transactional phase, migrate the configuration into a server-only environment or protected settings table, then disclose it only after checking current organization membership. Do not put these contacts in NEXT_PUBLIC variables, static JSX, browser fixtures, public metadata or client bundles. The general storefront support configuration must remain unchanged.

## Next implementation phases

1. Organizations and membership: approved company onboarding, verified login, company roles, invitations and RLS. Existing retail login alone must not grant company access.
2. Trips and requests: durable server-side records, travelers, selected real plan IDs and commercial quote snapshots. User/company association must come from the session, not request payloads.
3. Administrative review: extend the existing protected admin area with audit trails. A company coordinator must never approve provider issuance. Separate requested, approved, awaiting payment, paid/authorized credit, provisioning and delivered states.
4. Fulfillment: reuse the existing idempotent eSIM Access issuance/Resend infrastructure. Emit only after explicit commercial gates, with per-item retries and correct provider-confirmed activation.
5. Distribution: recipient-scoped, revocable private links; on-demand individual download/ZIP; company-initiated WhatsApp sharing. Never expose all company eSIMs through a traveler link. QR access/download needs auditing and authorization.

No commercial B2B service should be enabled by merely removing the preview banner.

## Verification

- `node --experimental-strip-types --test tests/portal.test.mjs`: routing, dates/capacity validation, package/individual request rules, request state transitions and no fabricated fulfillment.
- `node scripts/test-portal-web.mjs`: read-only local HTTP smoke test with actual Host headers, 20 localized screens, blocked retail routes, noindex/cache controls, private-contact absence and ordinary-store preservation. Default port 3005; override `PORTAL_TEST_URL` if needed. This is not a browser interaction test.
- TypeScript, lint and production build should pass before deployment.
- Visual interaction testing at mobile/desktop sizes remains necessary. If the computer-use runtime cannot start, report that limitation instead of claiming screenshots or device checks were completed.
