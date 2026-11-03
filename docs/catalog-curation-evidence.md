# Catalog curation evidence

Internal review dated 2026-11-03. This audit changes no catalog, prices, margins, checkout amounts or supplier bindings. Inputs are user-supplied snapshots, not a live provider verification.

## Inputs and identity coverage

Recommendation CSV: 202 data rows. Review CSV: 2477 data rows. Workbook: Por pais 202, Regionales 42, Auditoria SKU 2477 data rows. The review CSV SKU/package-ID pairs match the workbook audit sheet. No duplicate workbook SKU was found.

Current local catalog has 1730 fixed plans. 709 catalog SKUs are absent from the workbook audit sheet; 1456 workbook SKUs are absent from the public catalog. These are snapshot differences, not evidence of provider withdrawal. Missing package codes remain unknown.

## Verified distinctions

- Canada standard common plans: Rogers Wireless, APN isp. Fixed Premium: SaskTel, Telus and Bell, APN internet (local plan-details.json). Fixed Premium package IDs and breakout IP are absent from the supplied SKU audit. Daily Premium evidence must not be borrowed. Premium is a provider label, not a quality ranking.
- Japan standard: SoftBank, KDDI/au, Rakuten Mobile and NTT docomo; APN mobile.three.com.hk; audited fixed standard IP HK. IIJ: NTT docomo, APN vmobile.jp; fixed IIJ audit explicitly states IP JP. This supports a distinct Japanese breakout modality, with one operator, without a claim of superior performance.
- US standard and USIP have identical Verizon/AT&T and bicsapn entries in local plan details. The supplied audit has no fixed USIP rows. Its daily USIP rows do not verify fixed USIP routing or package IDs. Keep the label as provider identity pending exact fixed evidence.
- Thailand standard common plans: TrueMove H/DTAC, cmlink, audited IP HK. Fixed nonhkip: DTAC/AIS/TrueMove H and e-ideas from local details. Fixed nonhkip IDs and IP are absent in the supplied audit. The operator/APN distinction is supported; exact breakout country is not verified for those SKUs.
- Australia standard and nonhkip both have Optus, e-ideas and audited IP SG. A suffix alone supplies no meaningful distinction. Do not present nonhkip as better coverage, local Australian IP or improved latency.

## Deterministic eligibility and priority proposal

1. Exclude daily/FUP plans using existing fixed-only policy. Never change price or monetary eligibility.
2. Require the exact SKU to be currently published, fixed, present in the current provider snapshot, bound without identity conflicts, and commercially available through existing checks. Audit-file absence alone does not prove live unavailability.
3. Apply reviewed SKU-specific incidents or exclusions first. Carry APN, activation and uncertainty warnings from exact SKU facts. There are no dated incident outcomes in these three inputs; operator-count or HK-IP alerts are characteristics, not incidents.
4. Group comparable choices by destination, GB, days and meaningful verified modality. Retain standard plus genuinely distinct technical variants. Do not create a quality score from operator count, IP country, Premium suffix or price.
5. For equal technical configurations choose an explicit reviewed SKU allowlist first, then stable SKU lexical order. User choice can select a distinct modality. Do not automatically promote unreviewed new variants.
6. Disappeared provider SKUs become unavailable and cannot silently be substituted under an existing SKU/order. Reappearing exact identities may recover availability after validation. New SKUs require explicit review before recommendation.

## Activation and APN cautions

100MB sample SKUs in all five destinations activate at installation. Canada CA_75_30 activates after purchase and uses sp.telus.com, Telus and IP CA. Thailand TH_50_10 activates at installation, uses internet and True Move (4G), IP TH. Preserve these exact exceptions. Common fixed variants generally activate on first network connection, but use each SKU record. Global technology and operator technology fields can differ (for example Japan 500MB global 3G/4G versus operator 5G); do not turn them into guaranteed speed.

## Existing synchronization behavior

`scripts/import-catalog.mjs` validates unique slug identity and overwrites local destinations/plans from Full Speed rows, excluding Unlimited FUP. It does not maintain reviewed recommendation policy. Supplier IP and cost are intentionally excluded from public importer output.

`src/lib/integrations/esimaccess-catalog.ts` compares exact slug, allowance bytes, duration and coverage. Missing and conflicting identities are separated from matches. `scripts/check-esimaccess.mjs --sync` refuses conflicting/empty matches and duplicate plan/package identifiers, then calls the private binding RPC. `20261024000400_provider_safe_refresh.sql` atomically marks existing matching-identity bindings unavailable, then upserts validated matches as available. It does not delete historical rows or alter published catalog/retail prices. Guarding complete snapshot acquisition remains essential: missing results in a valid partial snapshot could mark bindings unavailable.

## Exact focus mappings

Blank package-code or IP cells mean absent from the supplied exact-SKU audit. Local details still supply network/APN/activation facts. Full non-monetary machine-readable evidence is in private-data/catalog-curation/source-audit.json and sku-evidence.csv.

| SKU | Provider package code | Audit breakout IP | Activation | APN |
| --- | --- | --- | --- | --- |
| CA_0.1_7 | PT73ZDYVK | US | installation | isp |
| CA_0.5_7 | PIORZG0R5 | US | network | isp |
| CA_1_7 | CKH516 | US | network | isp |
| CA_1_7_Premium |  |  | network | internet |
| CA_3_15 | CKH578 | US | network | isp |
| CA_3_15_Premium |  |  | network | internet |
| CA_3_30 | PJYU684PF | US | network | isp |
| CA_3_30_Premium |  |  | network | internet |
| CA_5_30 | CKH579 | US | network | isp |
| CA_5_30_Premium |  |  | network | internet |
| CA_10_30 | CKH778 | US | network | isp |
| CA_10_30_Premium |  |  | network | internet |
| CA_20_30 | CKH779 | US | network | isp |
| CA_20_30_Premium |  |  | network | internet |
| CA_50_30 | PJV1FP85S | US | network | isp |
| CA_75_30 | PMJ9AFZEP | CA | purchase | sp.telus.com |
| JP_0.1_7 | P6ZMSDS1G | HK | installation | mobile.three.com.hk |
| JP_0.5_7 | PVDISIFP6 | HK | network | mobile.three.com.hk |
| JP_1_7 | JC063 | HK | network | mobile.three.com.hk |
| JP_1_7_IIJ | PK3VHQ9T6 | JP | network | vmobile.jp |
| JP_1_7_nonhkip |  |  | network | e-ideas |
| JP_3_15 | JC064 | HK | network | mobile.three.com.hk |
| JP_3_15_IIJ | PR8JET2E0 | JP | network | vmobile.jp |
| JP_3_15_nonhkip |  |  | network | e-ideas |
| JP_3_30 | P2AJZD4YX | HK | network | mobile.three.com.hk |
| JP_3_30_IIJ | P2P4EE3TH | JP | network | vmobile.jp |
| JP_3_30_nonhkip |  |  | network | e-ideas |
| JP_5_30 | JC065 | HK | network | mobile.three.com.hk |
| JP_5_30_IIJ | PYTKZG843 | JP | network | vmobile.jp |
| JP_5_30_nonhkip |  |  | network | e-ideas |
| JP_10_30 | JC066 | HK | network | mobile.three.com.hk |
| JP_10_30_IIJ | PAK783GRS | JP | network | vmobile.jp |
| JP_10_30_nonhkip |  |  | network | e-ideas |
| JP_20_30 | JC145 | HK | network | mobile.three.com.hk |
| JP_20_30_IIJ | PMR7KU23C | JP | network | vmobile.jp |
| JP_20_30_nonhkip |  |  | network | e-ideas |
| JP_50_30 | P98RPDQR0 | HK | network | mobile.three.com.hk |
| JP_50_30_IIJ | PE5N02WZA | JP | network | vmobile.jp |
| JP_50_180 | PL4E7JOWX | JP | network | vmobile.jp |
| US_0.1_7 | P3YTYXBRV | US | installation | bicsapn |
| US_0.5_7 |  |  | network | bicsapn |
| US_1_7 |  |  | network | bicsapn |
| US_1_7_usip |  |  | network | bicsapn |
| US_3_15 |  |  | network | bicsapn |
| US_3_15_usip |  |  | network | bicsapn |
| US_3_30 |  |  | network | bicsapn |
| US_3_30_usip |  |  | network | bicsapn |
| US_5_30 |  |  | network | bicsapn |
| US_5_30_usip |  |  | network | bicsapn |
| US_10_30 |  |  | network | bicsapn |
| US_10_30_usip |  |  | network | bicsapn |
| US_15_30 |  |  | network | bicsapn |
| US_20_30 |  |  | network | bicsapn |
| US_20_30_usip |  |  | network | bicsapn |
| US_20_90 |  |  | network | bicsapn |
| US_50_30 |  |  | network | bicsapn |
| US_50_30_usip |  |  | network | bicsapn |
| US_50_180 |  |  | network | bicsapn |
| US_100_10_usip_FIFA |  |  | network | bicsapn |
| TH_0.1_7 | PQ2I5PFIT | HK | installation | cmlink |
| TH_0.5_7 | PLBDYMED4 | HK | network | cmlink |
| TH_1_7 | JC045 | HK | network | cmlink |
| TH_1_7_nonhkip |  |  | network | e-ideas |
| TH_3_15 | JC046 | HK | network | cmlink |
| TH_3_15_nonhkip |  |  | network | e-ideas |
| TH_3_30 | JC013 | HK | network | cmlink |
| TH_3_30_nonhkip |  |  | network | e-ideas |
| TH_5_30 | JC014 | HK | network | cmlink |
| TH_5_30_nonhkip |  |  | network | e-ideas |
| TH_10_30 | JC047 | HK | network | cmlink |
| TH_10_30_nonhkip |  |  | network | e-ideas |
| TH_20_30 | JC080 | HK | network | cmlink |
| TH_20_30_nonhkip |  |  | network | e-ideas |
| TH_50_10 | PMNNJOETO | TH | installation | internet |
| TH_50_30 | JC081 | HK | network | cmlink |
| TH_50_30_nonhkip |  |  | network | e-ideas |
| TH_50_180 | PNJW9PBXH | HK | network | cmlink |
| AU_0.1_7 | PGWEQ1CSB | SG | installation | e-ideas |
| AU_0.5_7 | PI27MAKKL | SG | network | e-ideas |
| AU_1_7 | JC018 | SG | network | e-ideas |
| AU_1_7_nonhkip | PBNG7JU46 | SG | network | e-ideas |
| AU_3_15 | JC019 | SG | network | e-ideas |
| AU_3_15_nonhkip | PMJWN96M5 | SG | network | e-ideas |
| AU_3_30 | PM2ZWH3G5 | SG | network | e-ideas |
| AU_3_30_nonhkip | P5WU3XAH8 | SG | network | e-ideas |
| AU_5_30 | JC020 | SG | network | e-ideas |
| AU_5_30_nonhkip | PTV5G02KL | SG | network | e-ideas |
| AU_10_30 | JC101 | SG | network | e-ideas |
| AU_10_30_nonhkip | PN9GT8RR1 | SG | network | e-ideas |
| AU_20_30 | JC102 | SG | network | e-ideas |
| AU_20_30_nonhkip | P1B5ZKL9Y | SG | network | e-ideas |
| AU_50_30 | PQGQ6Y07S | SG | network | e-ideas |
| AU_50_180 | POU9P9TSZ | SG | network | e-ideas |
