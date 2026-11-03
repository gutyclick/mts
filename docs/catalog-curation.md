# Curated destination catalog

The destination page uses the existing published catalog and retail prices, with an independent commercial selection. No product, price, supplier cost, promotion policy or historical order is rewritten.

## Selection policy

`src/lib/catalog-curation.ts` owns deterministic policy version 1. Mandatory checks precede ranking: fixed data, positive existing retail cents, matching technical identity, matching destination/coverage, verified operator records, current provider binding, and no explicit commercial hide/incident block. Provider binding projection validates exact slug, duration and GB/MB capacity using the same binary/decimal tolerance as the existing importer.

Up to four primary categories per approved connectivity mode: Basic (1–under 3 GB), Essential (3–under 6 GB), Plus (6–under 20 GB), Max (20+ GB). References are 1/5/10/20 GB and 7/30/30/30 days. Ordinary 31-day products are valid alternatives. The algorithm never creates substitute capacities or durations. In a category, manual priority wins, then explicit show, network-start activation, distance from reference capacity/duration, current retail price and stable exact SKU. No operator-count or speed quality score is invented.

Plans under 1 GB remain internally available; they do not fill primary cards. Longer stays remain in a collapsed secondary section with their real prices and identifiers. Existing fixed-only policy continues to exclude daily/FUP products; this task does not import or publish new products.

Only Essential receives Recommended, and only when its recommendation eligibility permits it. A missing category is omitted. Showing a plan does not bypass mandatory checks or the four-primary limit.

## Connectivity variants

Default configuration is Standard. One to three connectivity variants may be explicitly approved by administration with an evidence note. Each candidate SKU must itself demonstrate a distinct operator configuration or a verified different breakout IP against a comparable standard plan. Approval of one SKU never approves unrelated same-suffix packages automatically.

Local IP is used only when every offered SKU in that mode has exact supplier evidence for the destination IP. Other IP-only configurations are described neutrally, without asserting different networks. Identical Australia variants do not produce a selector. Canada/Japan/Thailand candidates can be reviewed in administration; unsupported fixed USIP IP claims are not inferred from daily packages. No special approvals have been inserted automatically.

`catalog-connectivity-evidence.json` contains exact SKU-matched supplier snapshot evidence only: package code, breakout IP and source identifier. It is not proof of present availability and includes no costs. The server uses current private binding availability through an ID-only projection. Evidence notes and editor identities remain private.

## Integration and reversibility

`getPublishedPlans` retains its technical catalog meaning. `getCuratedCatalog` is the presentation path; cart resolution only excludes explicit commercial withdrawals, preserving old carts for technically available, nonfeatured SKUs. Payment preparation separately validates withdrawals for ordinary, coupon and SimCoins paths. Already paid settlement, fulfillment, installation and historical receipts are untouched.

The public page receives only offered plans/mode descriptions, not internal decisions. Support recommendations use the same curated selection. Existing destination URLs, canonicals, language alternates and titles are preserved. Structured lists describe rendered primary and secondary products; there are no variant landing pages. The original localized editorial and FAQ structure remains.

Merchandising tables are independent of provider binding refreshes. Admin decisions therefore survive synchronization. Existing provider checks compare exact identity; disappeared packages become unavailable, never silently substituted. Catalog seed insertion preserves existing rows, and override foreign keys restrict deletion.

## Verification and reports

- Pure selection tests cover mandatory gates, manual overrides, every special SKU, neutral IP wording, long stays, 31-day alternatives, deterministic ordering, duplicate capacities/durations, actual destination identity and unchanged prices across the complete local catalog.
- Database tests cover admin-only writes, audit records, private notes/editor identifiers, provider synchronization, explicit blocking, private original payment functions, all three payment preparation paths and preserved order/SimCoins amounts.
- UI tests exercise actual selected SKU, existing prices, mode changes, secondary deep links, and empty/secondary-only modes.
- Real browser: Spanish desktop and 390/320-pixel mobile view; Plus selection resolves `JP_10_30` in the cart with the existing EUR amount. The QA item was removed. No payment submitted or eSIM issued.
- Live supplier read-only check: 1,724 published plans matched, zero missing or identity conflicts; 91 unlisted supplier products were not imported.
- The live selection audit covers 240 published destinations, with 931 primary selections, 64 secondary long-stay options and no empty destination. The current retail fingerprint is `52387061d53712e1fbf5a37d93e8a76b5dce634627c2478094bece4504630953` before and after curation setup. No catalog writes occur during report generation.

`node --experimental-strip-types scripts/preview-curated-catalog.mjs` writes a read-only CSV and internal JSON under `private-data/catalog-curation`. `--local` explicitly labels the report as an offline snapshot, not live availability.

Rollback: deploy the prior presentation code and retain the additive tables/audit history. Clear or change overrides only through the audited administration API. No price rollback is necessary because no prices change. Existing manual blocks should remain until deliberately reviewed.
