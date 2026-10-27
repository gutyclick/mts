# Currency pricing operations

The storefront supports USD, EUR, GBP, CAD, CHF, AUD, MXN, COP, ARS, CLP, DOP, UYU, BRL, KRW, CNY, JPY, PEN and DKK. Only Spanish and English language routes exist.

## Price lifecycle

Catalog prices and historical accounting aggregates remain in USD. A new checkout freezes an additional local payment snapshot, using trusted Stripe informational base rates and per-unit rounding. JPY, KRW and CLP have zero decimal places. The amount displayed for an attempt is the amount submitted to Stripe. Existing attempts never change currency or amount when a preference or exchange rate changes.

Refund requests use the original local unit amount and currency. Never calculate refunds from current exchange rates. Administrative USD aggregates represent original base prices, not settlement proceeds after fees or currency conversion.

## Rates and recovery

Rates refresh on pricing requests after one hour under a database lease; a valid snapshot can serve new purchases for up to 24 hours. The source uses the existing LIVE Stripe server credential with informational FX quotes and no lock. Sandbox rates must not populate this shared cache. `npm.cmd run currencies:setup` warms the cache without a payment or FX lock. The public pricing endpoint exposes one selected quote, never credentials.

If rates are unavailable, the selector retains the previous valid preference, and a new foreign-currency checkout cannot proceed without a valid quote. Do not bypass server total, currency, product or line-price verification to recover availability. USD remains the original canonical path.

## Verification

Run `npm.cmd run test:currencies`, typecheck and the checkout, hold, refund, customer security and legal regression suites. `scripts/test-currency-checkout.mjs` requires a local TEST-mode server, creates unpaid TEST sessions, checks all 18 currencies, reuse and receipt amounts, then cleans its own disposable fixtures. It never confirms payment, issues an eSIM or sends mail. Do not run this workflow against a live-mode server.

On 2026-10-27: 34 regression tests passed; all 18 actual Stripe TEST session currencies and amounts were inspected successfully; fixtures and sessions were retired. Desktop and 390px mobile selector, language navigation, JPY unit/quantity totals and checkout summary were verified.
