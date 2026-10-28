# SimCoins commercial launch — 27 October 2026

The owner explicitly authorized publication and activation in checkout and customer/admin panels, and confirmed that real purchases already work. A read-only database check found two paid live orders. Historical orders are not enrolled retroactively.

The launch retains five levels (Traveler 0%, Explorer 3%, Adventurer 4%, Globetrotter 5%, Legend 6%), the 5% redemption ceiling and seven-day release after verified delivery. The first qualifying purchase unlocks Explorer for later purchases.

## Database and margins

- Encrypted, consistent logical snapshot of 70 public/auth/storage tables saved under ignored private-data, with the encryption key held separately in the local environment file. This is not a full disaster-recovery backup or a proven restore rehearsal. Supabase reported no physical backups available and PITR disabled.
- Migrations 003–005 validated against the actual database schema in a rolled-back transaction, then applied successfully. Five levels, RLS, private tables and denied anonymous/authenticated financial RPC access verified.
- Current authenticated provider responses matched all 1,724 published plan identities. 880 plans passed a conservative single-unit calculation at Legend, full 5% redemption and the higher FX fee budget. 844 plans were excluded by the launch margin criteria. Retail prices remain unchanged. Runtime checks still enforce real FX rounding, current costs and per-order contribution.
- New/repeated opt-in batches disable plans outside the verified set and record an audit. No historical financial snapshot was created by setup.
- The service-only worker configuration schedules idempotent release processing every five minutes inside Supabase Cron. It does not copy secrets into an HTTP scheduler.

## UI and copy

Customer dashboard includes current level, available coins, pending coins and a wallet link. The wallet contains level progress, next threshold and activity; the existing admin panel supports levels, eligibility, audited settings and adjustments with MFA. Checkout uses trusted server quotes for earning and redemption.

Unused demonstration components and their stale labels were removed. README and current account/checkout/deployment documentation now describe real payments and fulfillment. Historical verification logs remain historical evidence.

## Validation

37 existing SimCoins tests and the new scheduler test passed. The combined financial/payment/currency/refund/fulfillment/dashboard run passed 64 tests before the scheduler test was added; the default 18-test suite also passed. TypeScript, ESLint and the production webpack build passed (599 generated pages).

Production publication, activation and live smoke-check results will be appended after deployment.
