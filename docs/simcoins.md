# SimCoins — implementation and launch review

Visual update: the calculator has been removed at the owner's request. The current landing uses compact rewards information, supplied rank badges and small coin illustrations in balance/redemption contexts. See [the UI and SEO review](simcoins-ui-seo.md).

## Status and boundaries

Active in production following the owner's authorization on 27 October 2026, including checkout, account balances and levels, administration and the worker. The three additive migrations were applied after a rolled-back validation against the real schema. 880 identity- and margin-verified plans participate; runtime cost/FX/contribution checks remain authoritative. See [launch evidence](simcoins-launch.md). Default environment templates remain off for new installations. No historical orders are enrolled, repriced or modified. Existing catalogue prices and recorded wholesale prices are not changed.

The separate, private `simcoins_private_costs` cache holds authenticated, identity-checked current supplier quotations in 1/10,000 USD units. It does not overwrite the catalogue's wholesale records or expose costs to browsers. Missing, stale or ambiguous costs exclude rewards. Provider refresh is lease controlled.

## Product decisions

The owner selected a separate welcome tier at 0%. Its short localized name is **Viajero / Traveler**. After the first qualifying purchase, Explorer applies to later purchases. A purchase that crosses several thresholds can unlock a higher tier. The percentage is frozen from the customer's tier **before** that purchase.

| Tier               | Eligible cumulative USD spend      | Rate |
| ------------------ | ---------------------------------- | ---- |
| Viajero / Traveler | Registered; no qualifying purchase | 0%   |
| Explorer           | First qualifying purchase          | 3%   |
| Adventurer         | 60                                 | 4%   |
| Globetrotter       | 125                                | 5%   |
| Legend             | 300                                | 6%   |

Explorer's database threshold of one USD cent expresses “some qualifying spend”; the interface never advertises a one-cent purchase. Refunds reverse qualifying spend and can lower a tier. No retroactive reward applies to the first purchase or to pre-program orders.

100 whole coins equal USD 1 of promotional purchasing credit. Coins cannot be transferred, withdrawn or exchanged for cash and have no ordinary MVP expiry. The total earned amount rounds **down** once; largest-remainder allocation distributes the exact total to units. Redemption uses whole coins, up to 5% of eligible value and available balance. Equal units on the same Stripe line receive equal discounts; unused remainder coins remain available.

Release initially requires paid status, valid provisioning, sent fulfillment, a signed `email.delivered` event for the corresponding delivery, and seven days after the latest relevant event. API acceptance alone is not delivery. Delay is configurable, and no refund right is changed by this delay. Absence of delivery evidence leaves coins pending for operational review.

## Architecture

- `src/lib/simcoins/engine.ts`: exact BigInt calculations and deterministic financial snapshots.
- `config.ts` / `model.ts`: centralized defaults, flags and contracts.
- `server.ts`: validated settings and private owner wallet projection; no costs in customer DTOs.
- `checkout-server.ts`: trusted catalogue/cost/FX quote, opaque quote ID and reservation adapter.
- Additive migrations `20261027000300_simcoins.sql`, `20261027000400_simcoins_analytics.sql` and `20261027000500_simcoins_worker.sql`: service-only RPCs, immutable snapshots, append-only ledger, row locks, compensation postings, audits and explicitly configured release scheduling.
- Public `/{es,en}/simcoins`, authenticated `/{es,en}/account/simcoins`, MFA-protected `/{es,en}/admin/simcoins`.
- Existing authoritative order/refund changes drive database triggers. The browser redirect never grants rewards. Existing provider provisioning and Stripe identity verification remain authoritative.

### Financial gate

The initial conservative estimate reserves Stripe 4.4% + USD 0.30, or 5.4% for FX, and an 8% affiliate budget. A configurable additional variable reserve is supported. Even when no affiliate is attributed, the initial engine retains this conservative budget; it does not infer a lower commission from a browser claim.

```
contribution = actual eligible cash received
             - verified wholesale cost
             - estimated Stripe fees
             - affiliate budget
             - earned coin liability
             - other variable reserves
```

Taxes do not earn coins. Discounts and redeemed coins reduce the cash base; redemption is not subtracted again as a separate cost. General promotions do not automatically stack with redemption. Target contribution is at least 20% of actual cash collected. Per-unit and whole-order gates both apply. Existing checkout currently supplies no promotion/tax adjustments; SQL rejects a fabricated promotion/tax snapshot rather than accepting unsupported discounts.

FX uses the frozen 10^10 scaled trusted quote and the existing per-unit currency rounding. Conservative inverse conversion floors actual paid USD cents for earning and progress, while fee estimates use the higher canonical net amount. A redemption that produces no local-currency saving is suppressed. USD gross historical order fields retain their established meaning; frozen `payment_*` fields hold the actual discounted selected-currency payment. No Stripe coupon is introduced that would bypass existing exact line checks.

### Concurrency and recovery

The ledger is the source of truth; mutable balance columns are not. Available → reserved transfers occur inside the account lock and transaction. Order-before-account lock ordering coordinates reservations, settlement and refunds. Unique business keys make duplicate webhooks and releases harmless. Successful payment consumes the reservation; authoritative unpaid cancellation/expiry restores it. Browser closure and ambiguous network responses do not release a potentially paid reservation.

Successful cumulative partial refunds use original unit allocations and original actual payment amounts, not today's FX or tier. They reverse earned coins and qualifying spend proportionally, restoring the original redeemed promotional coins. Rounding reaches the exact original total on a full refund. If earned coins were already used, reversal may create a visible debt that blocks further spending rather than losing the accounting trail.

**Recovery case:** a process can stop after reserving but before a Stripe session is bound. A missing session ID alone is not proof that Stripe created no session. Such a reservation remains safe from double spending and is surfaced for reconciliation. An operator must establish the authoritative payment outcome before cancellation/compensation. Never release merely because the customer closed the tab or an HTTP request timed out.

### Authorization and privacy

Customers have no browser write access to financial tables or service RPCs. Customer requests derive their owner from the authenticated verified session. Settings, eligibility and coin adjustments require existing admin membership and actual MFA assurance, same-origin JSON, bounded inputs, reason and stable request UUID. Adjustments append postings and audits; they never edit history or fabricate purchase progress.

Public analytics accept only enumerated events, consented pseudonymous session hashes and idempotent event nonces. DNT/GPC and withdrawal are respected. They do not receive user IDs, emails, installation secrets, wallet balances or individual reward values. Earned/redeemed/level-up/repeat-purchase events originate from authoritative ledger processing, not browser claims.

## Local verification

```
npm.cmd run test:simcoins
npm.cmd run typecheck
npm.cmd run lint
npx.cmd next build --webpack
```

Tests use PGlite and mocked APIs; no automated test emits an eSIM or charges/refunds a live payment. The ledger tests exercise actual migration functions with isolated auth/order/provider/email fixtures. Focused engine tests cover all rates, first-purchase timing, thresholds, exact rounding, fees, tax/promotion exclusion, insufficient margin, unknown costs and cumulative refunds. Checkout/admin/privacy tests exercise intent-only payloads, FX allocation, MFA/ownership boundaries and disabled behavior.

## Activation runbook

The owner authorized this launch on 27 October 2026. This checklist remains an operational reference; observed completion is recorded in [launch evidence](simcoins-launch.md).

1. Review UI, the program conditions, seven-day delay, conservative affiliate reserve and opt-in product selection with the owner. Review financial liability and statutory consumer/privacy wording before commercial launch.
2. Back up the database and validate both additive migrations against a staging copy of the real schema. Apply only after approval; do not backfill old orders.
3. Verify permissions, settings, five tier rows, append-only triggers, RLS and enabled=false in the target environment. Compare existing checkout/refund tests against the deployed schema.
4. Configure `SIMCOINS_PERSISTENCE_READY=true` only after migration verification. Keep master/earn/redeem false during inspection. Enable audited admin operations separately, through `SIMCOINS_ADMIN_ENABLED=true` and the database admin setting, with MFA already enforced.
5. Opt in verified fixed plans deliberately. Refresh authenticated wholesale quotes; evaluate real contribution at all tiers, FX currencies and redemption limits. Do not enable unknown-cost plans.
6. Call the service-only `configure_simcoins_worker()` after deployment and database activation. It schedules `simcoins_release_due(100)` every five minutes inside Supabase Cron, without transmitting a bearer credential. The protected HTTP endpoint `/api/internal/simcoins/run` remains available for operator checks using `SIMCOINS_WORKER_SECRET`, configured privately and never placed in a browser or Git. Both release paths are idempotent.
7. Test staging payment → provisioning mock → signed delivered event → delayed release, failed/expired/ambiguous payment, two-tab reservation and cumulative refunds. Verify consent/withdrawal and both locales/mobile layouts.
8. Obtain explicit production publication and activation approval. Enable both environment and database master/earning/redemption gates deliberately. Start with a small verified product set, observe pending liabilities, delivery evidence and margin exclusions.
9. Rollback: disable new earning/redemption gates first; retain migration/schema/ledger, refund processing and operational reconciliation. Never drop ledger tables or delete postings to turn the feature off. Honor existing committed snapshots and retain the private audit trail.

Until those steps are approved and verified, local implementation does **not** mean customers are earning or redeeming real SimCoins.

## Verification report — 27 October 2026

36 SimCoins tests, 25 focused existing regressions and the default18-test suite passed locally. ESLint and the production webpack build (including TypeScript,597generated pages) passed. Public ES/EN views, calculator, canonical/hreflang and image loading were checked against the local production build at390px and1440px, with no horizontaloverflow. Wallet and admin layouts were checked separately with labelled synthetic data, including Legend and its absence of a fictitious nexttier. Private authentication/financial authorization were validated in mocked/PGlite tests, not bypassed for a live visual test.

Security review corrected test-payment eligibility, graceful exclusion on unknown costs, the configured public-visibility failure mode and private exclusion auditing. The audit includes the financial exclusion reason and policy/line snapshot, deduplicated and ratebounded; failed optional audit transport never blocks an ordinary payment. No live credentials were printed, no remote migration/deployment ran, and no live eSIM/payment/refund was used.

This verification report records the original local implementation. The subsequent authorized commercial launch and its production checks are recorded in [launch evidence](simcoins-launch.md). Unbound/ambiguous checkout reservations require authoritative operational reconciliation as described above.
