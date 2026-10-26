# Operations Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make operations observable, refunds controlled, administration stronger, recovery verifiable and growth measurable.

**Architecture:** Extend existing protected Supabase/Next.js services with dedicated operations modules, server-only queues and private admin screens. Implement each subsystem independently and maintain this ledger through compaction.

**Tech Stack:** Next.js16.4.3, React19, Supabase/PostgreSQL17, Stripe, Resend, eSIM Access, Playwright, PGlite.

**Spec:** docs/superpowers/specs/2026-10-26-operations-readiness.md

## Global constraints

- Read relevant installed Next docs before code. No credentials or customer installation data in Git/logs/analytics.
- Alert address gustavo@mytripsim.com, thresholdUSD20. Public customer contact remains hello@mytripsim.com.
- No real purchase/refund, production overwrite, unrequested paid upgrade or real test notification.
- Keep unrelated deleted legacy JPGs unstaged. Use explicit file staging.
- Inline execution under executing-plans. Final independent review is required by that workflow; delegation is allowed for that explicit review only.

## Review focus

- Retried/late/out-of-order events must not duplicate emails, refund money or provider purchases.
- Invalid users, forged admin metadata and AAL1 sessions must not access operations or monetary endpoints.
- Refund reservation versus active fulfillment leases must be serialized.
- Restored databases must never run copied production jobs, webhooks or send real email.
- Consent withdrawal and bots must not create identifying analytics or fabricated conversion rates.

## Tasks

### 1. Operational alerts

- [ ] Verify provider balance API units and Resend webhook signature contract in primary docs.
- [ ] Create operations migrations/settings, alert episodes, delivery events, secure RPCs and signed scheduler.
- [ ] Add server modules under src/lib/operations and routes under api/internal/operations and api/webhooks/resend.
- [ ] Add private operations admin screen/navigation using existing design tokens, email template and environment configuration script.
- [ ] Watch failing tests, implement, run security/idempotency/webhook tests and ES/EN desktop/mobile tests.

### 2. Admin MFA and refunds

- [ ] Add admin security enrollment/challenge page and server actions, then require AAL2 throughout adminSession callers.
- [ ] Add refund-unit reservations, requests, approval transitions and audit migrations/RPCs.
- [ ] Add protected reviewed refund API/UI, Stripe execution and signed-event reconciliation, provider-cancellation disclosure.
- [ ] Prove ownership, amounts, environment isolation, retries, lease races and no duplicate charges/refunds with tests.

### 3. Backup and restore

- [ ] Inspect actual backup availability and supported export tools without printing secrets.
- [ ] Prepare encrypted backup/restore tooling, private evidence, explicit non-production guards and runbook.
- [ ] Run a real isolated rehearsal when prerequisites are available; distinguish data/schema fixture tests from actual recovery proof.
- [ ] Record any required owner action precisely; no silent claim of completion.

### 4. Measurement

- [ ] Add consent UI and preference controls, strict event schema, bounded retention/rate limits and private aggregate report.
- [ ] Instrument destination view/add-to-cart/checkout and server-confirmed orders; distinguish consenting cohorts.
- [ ] Update legal disclosures/version, test no collection before consent or after withdrawal and no PII in events.

### 5. SEO and release

- [ ] Audit production sitemap/robots/canonicals and render checks.
- [ ] Review GSC authenticated data after browser connection or identify missing source explicitly.
- [ ] Run relevant unit/security, build, lint, UI and secret checks; independent final review; migrate/deploy in safe order.
- [ ] Verify actual public/protected entry points; report completed versus owner-dependent work.

## Execution ledger

- 2026-10-26: Read existing admin, checkout webhook, fulfillment lease worker and notification code. Implemented draft alerts, signed Resend events, provider balance query, operational admin screen and MFA gate/setup. Four operations model/database tests and one MFA model test passed; targeted lint and full typecheck passed after adding balance/query to provider request types. No current-task migration or deployment yet. MFA enrollment retry UX and production integration verification remain pending. Alert recipient confirmed gustavo@mytripsim.com, threshold USD 20. Docker/pg_dump/psql not found on PATH; actual restore proof remains pending.
- 2026-10-26: Authenticated Search Console access established. Sitemap correct with 508 discovered URLs; both home locales indexed. Panama live Google test passed; accepted indexing requests for Spanish Panama, United States and Japan destination pages. No manual actions or security issues detected. Performance and aggregate indexing data still processing. Evidence and follow-up recorded in docs/seo-search-console-2026-10-26.md. Navigation consolidation into FAQ is local and awaiting publication.
