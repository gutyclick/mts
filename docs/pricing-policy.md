# Controlled pricing pilot

The operator workflow calculates a proposal before changing selling prices. Supplier costs, policy inputs, evidence, anchors and previews stay in ignored `private-data/` files. No browser route exposes them.

## Controls

- Configurable base uplift in basis points, rounded upward to whole USD. A competitor ceiling is rounded downward to whole USD so rounding never exceeds it. A market cap can reduce the effective uplift below the requested base uplift.
- Configurable low-price threshold and maximum effective increase. Plans that cannot increase by a whole dollar within this cap remain unchanged.
- Contribution is measured against the amount collected after the maximum budgeted discount. Subtract wholesale price, variable Stripe and affiliate fees, the fixed fee and optional extra per-unit costs. Revenue rounds down and fees round up. The fixed transaction fee is allocated entirely to one unit for a conservative single-unit scenario.
- Missing or stale evidence, missing fee assumptions, unverified equivalent plans and inadequate contribution block the increase. Existing prices above market are held for separate review; the pilot never cuts prices automatically.
- Scope is limited to 20 unique destinations. The same campaign retains original anchor prices; repeating it does not compound the uplift.

The current country comparison checks fixed allowance, duration, single-country coverage and standard data-only service class. It does not promise equal operators, latency or every contractual term. Regional packages with different coverage and special IP variants require separate evidence and remain unchanged. Market observations are a snapshot, not a guarantee of future prices or measured demand.

## Operator files and commands

`private-data/pricing/policy.json` contains campaign, destinations, upliftBps, minContributionBps, lowPriceThresholdCents, maxLowPriceIncreaseBps, maxEvidenceAgeMs, feeBps, fixedFeeCents, maxDiscountBps, affiliateBps and otherUnitCostUnits. Supplier costs use USD units of 1/10000; ordinary prices use cents. Policy basis points use 10000=100%.

`private-data/audits/demand-market-evidence.json` contains destination-keyed source URLs, checkedAt timestamps and observed fixed-plan cards in USD. Refresh those observations before a new proposal; never relabel an old observation with a fresh timestamp.

```powershell
node --experimental-strip-types scripts/preview-demand-pricing.mjs
node --experimental-strip-types scripts/apply-demand-pricing.mjs --apply
```

The preview reads the current published catalog and authenticated wholesale BASE packages. It verifies exact provider identity and writes a private CSV and JSON with eligible changes and hold reasons. The apply command requires that same fresh preview and policy, rereads current selling prices, reruns every pricing control, prepares and independently verifies new Stripe test/live prices, then publishes catalog prices and both private Stripe bindings in one database transaction. No customer is charged and no eSIM is issued by these commands.

`pricing_campaign_changes` is a private service-only ledger with original prices and Stripe IDs. Failed database publication rolls back all catalog/binding updates. Prepared Stripe prices can be reused safely on retry. Original order payment snapshots remain unchanged; pending attempts keep their original amount. Recovery of a completed campaign requires a deliberate operator action using the ledger, not silently rerunning the uplift.

The bundled selling-price file is updated after successful publication. Commit its selling prices only, never private cost/configuration files. Production pages read Supabase at request time, so the database publication takes effect without an application deployment.

This is a controlled price pilot, not an automated demand experiment or a new coupon/affiliate system. The contribution threshold is guaranteed by the supplied cost assumptions and price evidence at calculation time; future cost/fee changes require recalculation. Do not introduce larger discounts or additional fees without reassessing the floor.

## Verification

```powershell
node --experimental-strip-types --test tests/pricing-policy.test.mjs tests/pricing-campaign.test.mjs tests/retail-prices.test.mjs tests/stripe-catalog.test.mjs tests/currency*.test.mjs tests/payment-holds.test.mjs
```

Tests cover low-price rounding, market ceilings, discounted contribution, stale/missing inputs, baseline protection, public-role rejection, transaction rollback and idempotent publication.

## Pilot publication — 27 October 2026

Campaign demand-2026-10-27-v1 considered 103 published plans across the eight home/audited destinations. It published 24 eligible standard-plan increases in Japan, United States, France, Italy, Thailand and Spain. Mexico and Europe remained unchanged under the controls. All 79 held plans retained their original price. Special IP variants and regional packages without equivalent evidence were held. Each changed price and both Stripe test/live bindings were verified after atomic publication. A repeat application returned without another increase. No charges, eSIM issuance or order modifications occurred.

The configurable low-price pilot cap is 20% for anchors up to USD5. This deliberately keeps USD3 and USD4 prices unchanged when the next whole dollar would exceed the cap. The base uplift is 12%; whole-dollar rounding means the effective increase can exceed 12%, as the attached selling-price CSV states explicitly. Market ceilings can also reduce an increase.

[Published selling-price changes](audits/2026-10-27-piloto-precios.csv). Private contribution calculations remain in the operator preview.
