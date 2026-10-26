# Operations readiness specification

Date: 2026-10-26. User explicitly requested all five workstreams: operational alerts, reviewed/authorized/audited admin refunds, security/backups/restore rehearsal, privacy-respecting sales measurement, and actual Search Console review. This is implementation authorization, not authorization to refund a real customer as a test, issue a paid eSIM, buy infrastructure, or restore over production.

## Confirmed decisions

- Alert recipient: gustavo@mytripsim.com, explicitly supplied by owner. Low provider-balance threshold defaults to USD 20 from the proposed setting; owner changed only the email.
- Preserve existing orange/blue MyTripSim UI, ES/EN, mobile support, secrets server-side.
- Owner must perform real MFA enrollment with their authenticator; never enter/read their production OTP/QR for them.
- Browser connection was initially unavailable. On 26 October it became available and the owner signed in to Google; authenticated Search Console findings are recorded in docs/seo-search-console-2026-10-26.md. Aggregate reports are still processing; no traffic or ranking metrics should be invented.
- PostgreSQL clients and Docker were not found on PATH. Linked Supabase project healthy, Postgres17, us-east-1. Backups/restore require further tool/capability assessment; do not claim a fixture rehearsal is a production-backup restore.

## Deliverables

1. Persist deduplicated alert episodes for overdue live paid orders, failed/bounced transactional deliveries and supplier balance. Scheduled signed worker, cooldown, bounded batches, notification audit, admin overview. Verify Resend webhooks before trusting them; no QR/email/card data in alerts. Exclude test and QA orders. Never resend a QR or repurchase merely to resolve an alert.
2. Refund request/review/approval/execution/audit UI with server-calculated limits and Stripe idempotency/reconciliation. Bind to authorized order, live/test environment and purchased units; prevent refund/fulfillment races and duplicate monetary effects. Do not automatically cancel an issued eSIM at the supplier. Explain this in approval UI. Test with mocks and PostgreSQL, not real refunds.
3. Require admin MFA with a safe setup/challenge route; enforce assurance on every admin API/page, preserve normal customer login. Verify existing backup coverage and provide an isolated, non-destructive restore rehearsal and recovery runbook. Never restore into linked production; never commit/export unencrypted credentials or production data.
4. First-party consent-controlled funnel events, no email/QR/credentials/full URLs, short retention and private aggregate admin reports. Distinguish consented funnel samples from all financial orders. Withdrawal stops collection. Update privacy/cookie disclosures and versioned notice if needed.
5. Re-audit live sitemap, canonicals, robots and representative pages; review actual GSC indexing/performance once connected, otherwise explicitly document the missing authenticated data instead of inventing metrics. Preserve current canonical www host.

## Existing implementation constraints

- Supabase service client is checkoutDatabase; adminSession verifies user + admin_memberships but currently no MFA. Existing admin APIs call it, including staff ticket APIs through supportUser(true).
- Payments live; 1,730 bound prices. Signed Stripe webhook currently handles checkout.session events only. Never change paid state manually.
- Fulfillment jobs use leases, idempotent provider purchase IDs and Resend IDs; claims scheduled every30sec through signed pg_net/cron. Selected refunds must not race a worker lease.
- Existing outbound support notifications use lease + idempotency. Reuse patterns, not the support ticket queue for operational alert subjects.
- Public legal version2026-10-26-v1; checkout acceptance table logs order/version/locale without retroactive backfill.
- Existing unrelated deleted JPGs in public/images remain user-owned and unstaged. Latest clean task commit d6cea75 (122 banners). Do not include those deletions.
