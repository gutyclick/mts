# Sales measurement

Private dashboard: `/es/admin/analytics` and `/en/admin/analytics`, linked as “Ventas y conversión” / “Sales and conversion”. Membership plus AAL2 required for both page and API. Periods: rolling 1, 7 or 30 days.

## Meaning of the report

- Financial cards include every confirmed **live** paid order in the period, including buyers who decline statistics. Amount is **gross before refunds**, not net income. Test payments are excluded.
- Funnel counts distinct consenting 30-minute sessions at each stage: destination viewed, successful cart addition, payment form prepared by the server, payment confirmed by the authoritative order status. Stages are independent; a restored cart need not have a recorded destination view.
- Session cohorts use their creation date for the common report window. Conversion is sessions with paid events divided by recorded consenting sessions, never all paid orders divided by opt-in traffic. A purchase after the session's 30-minute lifetime still appears financially but is not attributed to that session.
- Destination ranking counts sessions per destination. No acquisition/referrer, advertising attribution or cross-device identity is claimed. Consent, blockers and technical failures limit coverage. No retroactive visitor history is reconstructed.

## Privacy and safeguards

Statistics stay off before affirmative consent. Equal accept/reject controls; footer preferences; separate from marketing. No external analytics scripts or pixels. DNT/GPC disables measurement and revokes the current session when a signal is observed. Private account, admin, support, checkout and installation paths do not emit browser telemetry. Payment stages are generated only by the server.

Signed preference cookie (180 days, no individual identifier); optional random HttpOnly session cookie (absolute 30 minutes, Secure in production). Database stores a separately namespaced HMAC, not the raw value. Strict event fields contain no emails, full URLs, customer references, QR or installation credentials. A temporary nullable order/cohort association supports the confirmed-payment stage. Events use a random per-consented-order key rather than the order reference.

Withdrawal removes current events and order association. A short-lived revocation marker plus transactional locking prevents an in-flight request recreating the withdrawn cohort. On database failure the signed choice becomes no immediately; the original bounded cookie remains solely for cleanup retries, with a visible pending notice. GET preferences retries cleanup, and an open page retries after 10 seconds then every minute until resolved/expiry. Other open tabs receive a BroadcastChannel refresh with no identifier. Earlier unlinked sessions cannot be located from a new session alone.

Tables have RLS, no anonymous/authenticated access; RPCs are service-only. Browser event bodies and origins are bounded/validated; browser-paid events rejected. Rate caps: 120 new cohorts per hourly HMAC network bucket; 120 distinct events per cohort. Financial callbacks swallow optional analytics failures. Checkout uses Next `after`, with bounded RPC timeout, so metrics cannot block buying. Payment-after-response race and prior-paid-order exclusion are covered by database tests.

Session/event retention 30 days; daily 04:15 UTC purge can add up to 24 hours. Abuse buckets expire in one hour, withdrawal markers in 30 minutes, both purged daily. Legal disclosures ES/EN updated to v2 without rewriting earlier order acceptances.

## Operations

`npm.cmd run analytics:setup -- --prepare` generates the dedicated ignored local secret. `--deploy-env` installs it privately in production Vercel settings. `--retention` schedules cleanup after migration008. Secrets never enter Git, browser code or command arguments.

Disable new collection with `ANALYTICS_ENABLED=false` and redeploy; keep the secret and retention job available for withdrawal/cleanup. Do not rotate the secret casually: it invalidates preference signatures and current-session lookup. No real financial actions are needed for verification.

Verification commands: `npm.cmd run test:analytics`, `npm.cmd run test:analytics:web` (local port3000, disposable user and own cohorts only), typecheck, targeted lint, production build. Financial callback and consent isolation are also checked in PGlite. UI reviewed at desktop and 390px; live admin UI must be checked after deployment.

Consent design reference: [ICO, managing consent in practice](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/how-do-we-manage-consent-in-practice/). This records implemented behavior, not a claim that every jurisdiction's legal requirements have been independently certified.
