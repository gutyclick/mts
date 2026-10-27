# Regional Preferences Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Implement inline; fresh independent final review only.

**Goal:** Let travelers select es/en and pay in their selected supported currency.
**Architecture:** Shared popup/provider; server-trusted Stripe FX snapshots, immutable local payment amounts beside legacy canonical USD records; actual-currency refund and receipt projection.
**Tech Stack:** Next16.4.3 React19 Supabase17 Stripe23, existing design tokens.
**Spec:** docs/superpowers/specs/2026-10-26-regional-preferences.md

## Global constraints
No secrets in Git/client/logs; no live financial QA or eSIM issuance. Preserve unrelated user images. Do not rewrite applied migrations. Correct zero-decimal minor units, exact server totals, old USD behavior and MFA boundaries. User explicitly chose actual multicurrency charging.

## Tasks
- [ ] 1 Popup/routing: native dialog, keyboard tabs/cards, ES/EN only, preserve plan/query/hash/admin page. Pure tests RED→GREEN, mobile/desktop UI, type/lint.
- [ ] 2 Pricing engine: Stripe quote snapshot source and SQL lock/lease, strict currency registry, decimal-safe conversion, cached public display quote, storefront preference and formats. Test stale/bad rates, rounding and no forged prices.
- [ ] 3 Checkout: immutable local price snapshot, inline existing-product local prices and generated-ID binding, local amount verification in webhook/hold/expiry; reject tampering, preserve retries and old USD. No live charge.
- [ ] 4 Refunds/receipts: exact original local amounts in unit refunds, actual PI/currency validation, receipt/wallet/admin views, USD base analytics disclosure, legalv3. Regression tests.
- [ ] 5 Review/release: independent review, fixes RED→GREEN, Stripe sandbox-only session inspection, integration/UI checks, secret scan, migration then clean tracked-code deployment, verify production no-charge endpoints.

## Execution ledger
- Existing workspace main retained under ongoing user authorization; user-owned six deleted legacy JPGs and Vietnam image excluded. Sales release HEAD f705c35 before this work.
- Read installed Next use-router and route-handler guides, frontend-design and brainstorming; applied frontend style from explicit reference. Popup implemented locally, two pure routing tests passed. Updated existing checkout E2E expectation to click language inside dialog. Fixed admin equivalentPath preserving analytics/operations/refunds/security/tickets.
- Initial popup build failed because removed equivalentPath import left a reference; replaced with tested regionalLanguageHref, needs fresh typecheck/build. Nothing in this task deployed/applied yet.
- User confirmed18 currencies and true selected-currency charging after async clarification. Stripe Adaptive Pricing researched: not chosen because auto/local pair selection and customer2–4% fee. Actual live informational FX Quotes probe (none duration, no charges) returned200/all17 foreign currencies; use trusted base_rate reciprocal without own markup. External ExchangeRate-API researched then rejected as unnecessary/informational-only source.
- Ruling: preserve canonical USD accounting and add payment snapshot beside it — avoids mixing currencies in existing gross-sales/provider calculations; cost: customer/admin projections must explicitly distinguish payment and base amounts, covered by regression tests.

- Currency core implemented:18-code registry, JPY/KRW/CLP0-decimal amounts, BigInt fixed-scale reciprocal base rates and per-unit half-up rounding; three pure tests green. FX cache migration009 and payment snapshot migration010 drafted, NOT APPLIED. Isolated FX lease/RLS/immutability and checkout freezing/tamper/stale-quote/legacyUSD tests green. Public pricing route and server cache/refresh implemented; FX refresh ALWAYS uses live informational Stripe quotes, so sandbox rates cannot poison shared pricing. Native popup now lists/searches18 currencies and shared preference provider is wired, but storefront/checkout charging integration still pending: do not deploy this partial state.
- Engineering correction: SQL text edits containing dollar-quote regex were initially corrupted by JS replacement-string interpolation; reconstructed pending migration010 and reran isolated test green. Future edits MUST use replacement callbacks for any copied SQL. No applied migration was modified. Initial popup missing equivalentPath reference fixed; latest typecheck sessions6857/92292 to inspect.

## Final implementation and validation (2026-10-27)
- Tasks 1-4 completed. ES/EN native popup and 18 selected charging currencies implemented across storefront, cart, checkout, receipts, wallet and refunds. Existing orders retain original payment currency; canonical USD analytics remain explicitly labelled.
- Migrations 009-012 applied successfully. Shared live informational Stripe base rates warmed for all 18 currencies, without a payment or FX lock.
- Independent review found no critical payment/SQL defects. Fixed redundant quote-fetch availability issue with RED/GREEN regression. Actual sandbox integration exposed imported mts_ product IDs; migration012 fixes binding with an exact namespace allowlist and regression coverage.
- All 18 actual Stripe TEST sessions verified exact currency, amount, generated line prices, reuse and receipt projection. No payment confirmed, no eSIM issued, no email sent. Disposable orders and unpaid sessions cleaned.
- Currency/regional suite 12/12 green; broader regression suite 34/34 green. Typecheck passed. Desktop and 390px mobile popup reviewed; keyboard tabs, search, JPY unit rounding and quantity total, checkout and ES/EN navigation verified. Test browser cart cleared and viewport reset.
- Release pending final staged secret scan and clean archive production deployment. User-owned image edits excluded.
- Production release af584f1 is READY: dpl_CdnEoRB6Ua4o7bdoiBD5DXuwts3N, aliased to https://www.mytripsim.com. Clean Git archive excluded local environment and unrelated image changes. Production USD/EUR/JPY/COP pricing returned200; checkout config remains live/enabled. Public popup visually verified with all18 currencies. Final typecheck, targeted ESLint and34 regression tests passed; staged secret scan60files clean. Documentation follow-up341c86e contains no runtime changes.
