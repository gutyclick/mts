# Checkout clarity and measurement implementation plan

> **For agentic workers:** Follow the approved six-point scope; implement independent areas in parallel, then integrate and verify together.

**Goal:** Understand purchase friction, make discounts transparent, and clearly distinguish paid orders from installable eSIMs.

**Architecture:** Extend existing consent-based first-party analytics, protected coupon RPCs/admin and fulfillment delivery components. Stripe and eSIM Access remain authoritative; no second payment or provisioning system.

**Tech stack:** Existing Next.js App Router, React, Supabase PostgreSQL, Stripe Elements, EN/ES and Lucide.

**Spec:** User-approved six improvements in this chat: checkout measurement; clear payment errors; visible coupon restrictions; payment-to-install progress; mobile audit; coupon performance.

## Constraints and review focus

- Do not modify retail prices, historical order amounts or real payment status for tests.
- No real payments or provider issuance in automated tests.
- Analytics requires consent and respects DNT/GPC. No emails, codes, QR or individual balances in analytics payloads.
- Incomplete checkout is not proof of abandonment; distinguish observed stages from mature non-conversion cohorts.
- Coupon finance is estimated contribution, not accounting profit; explicitly describe refund treatment and missing cost coverage.
- Preserve unrelated working-tree Google Ads changes; exclude them from this release.
- Never show delivery complete unless all expected units are installationReady; handle partial enqueue and retry states.
- Preserve cart and payment idempotency on errors; uncertain payment confirmation must direct to protected order verification.

## Tasks

- [x] Extend consent-based checkout events, deduplication and admin stage reporting with database and privacy tests.
- [x] Add safe rate-limited coupon review showing minimum, validity and scope before applying; add per-coupon financial insights.
- [x] Centralize bilingual payment error guidance, including declines, validation, uncertain status and safe recovery.
- [x] Integrate checkout events and coupon review without changing consent or amount validation.
- [x] Add authoritative delivery timeline and partial-order progress.
- [x] Test mock payment outcomes, guest/verified-user paths, currencies, consent, coupon boundaries and existing purchase security.
- [x] Run TypeScript, targeted lint and regression tests; apply additive migrations, build isolated release and verify live responsive UI without paying.
- [x] Document results and limitations, preserving unrelated work.
