# First-party sales measurement — implementation contract

Part of the authorized operations-readiness plan. Implemented; release verification recorded in the operations-readiness ledger.

## Product and privacy

- Measure **sessions with consent**, not all visitors. Four stages: destination detail viewed → added to cart → payment started (actual server checkout creation) → payment confirmed (server/DB authoritative).
- Optional statistics off until an affirmative choice. Equal accept/reject buttons; footer privacy-preferences control. Declining does not affect browsing, buying, support or delivery. Marketing opt-in remains separate.
- Respect DNT/GPC on client and server. Never send telemetry from admin/account/support/private installation pages. No email, QR, activation credentials, full URL, query string, referrer or arbitrary free-text fields in metric records.
- No third-party analytics scripts/pixels. First-party collection into protected Supabase tables, private AAL2 admin aggregate dashboard only.
- Preference cookie `mts_stats_consent=v1.yes|v1.no`, 180 days, necessary preference. Optional random session cookie: HttpOnly, Secure in production, SameSite=Lax, absolute 30-minute lifetime. Create only after affirmative consent; store only namespace-specific HMAC of its 32-byte value in the database. Separate server-only ANALYTICS_HASH_SECRET, generated/configured privately.
- Cohorts and events retained 30 days, automatic daily SQL purge. Preference withdrawal stops browser collection immediately and removes the current session's metric rows/linkage. Database failures retain the original bounded token solely for explicit cleanup retries. Do not promise erasure of every prior unlinkable session solely from a current browser preference. Explain rights/contact and pseudonymous nature accurately.

## Server contracts

- Client event schema strict: only `destination_view` and `add_to_cart`, validated canonical destination slug (and optional validated plan identifier only if needed). Reject extra fields. Do not accept purchase/paid events from browser.
- Server checks exact Origin, bounded body, preference, DNT/GPC and signed/opaque session cookie. Validate destination against actual catalog. Only emit successful add-to-cart actions, not invalid clicks.
- Dedicated pseudonymous cohort/event tables, RLS/revoked public access. Deduplicate per cohort/stage/destination; cap events/session. Security rate-limiting may use separately namespaced, short-lived hashed network buckets; no raw IP in analytics. Disclose this separately as security processing rather than claiming all network processing is anonymous.
- `checkout_orders` gains nullable cohort FK and random per-consented-order analytics key. Attach only after an authorized actual checkout order is created, before payment session response. No analytics failure may block checkout.
- Payment-start and paid events must be server-generated. Paid trigger checks live order and confirmed paid status, active consent cohort and consented random order key, deduplicates. No raw order ID or customer ID in event data. Test/QA payments excluded. Dropped/revoked cohort must not be resurrected by a late payment webhook.
- Withdrawal deletes current cohort (events cascade), clears pending order association/key. Expiry/purge drops linkage. Never copy consented tracking to a fresh session without the continuing affirmative preference.
- Aggregates count distinct consenting cohorts per stage over a common cohort window. Do not divide all financial sales by opt-in visitor counts. Show gross confirmed live sales separately with explicit label; no unsupported net-revenue or source attribution claims.

## UI/instrumentation

- Global client consent controller can live in SiteFrame or a provider above CartProvider; a no-store preference API initializes the client controller with collection off to avoid hydration mismatch and keep public rendering independent of cookie reads. Hide banners on admin/private flows; public footer retains preferences control.
- Compact accessible orange/blue consent card, nonblocking, responsive, clear focus, no preselected optional switch, no deceptive accept-only design. Avoid collisions with mobile navigation and SIM chat launcher.
- Track known destination route on pathname/consent changes, excluding `/esim/access`; never serialize search/hash values. CartProvider add/ensure only records if the cart changed successfully; duplicates deduplicate server-side.
- Private `/[locale]/admin/analytics` and `/api/admin/analytics` reuse administrative membership + AAL2, private/no-store/noindex. Aggregate counts, funnel and top destinations; no raw session browsing interface.
- Update cookies/privacy ES/EN with actual names, retention and purpose; legal version v2. Regenerate legal JSON. Preserve historical v1 order acceptances; do not relabel them. Consent UI records its own stats preference version, independent of accepting terms/privacy notices.

## Verification

- Before consent and after rejection/withdrawal/GPC/DNT: no optional session or event collection.
- Reject arbitrary fields, fake paid events and invalid destinations. Deduplicate, enforce retention and rate bounds. Never store email/QR/full URLs in database projections/events.
- Purchase callback cannot recreate deleted consent data; only true live paid orders count. Cohort rates exclude nonconsenting financial orders.
- Isolated database and mocked tests, actual local UI checks for accept/reject/preferences and mobile overlap, final independent review before activation. No actual purchase/refund needed.
