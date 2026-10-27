# Owner-approved commercial price correction

The owner approved the 27 October 2026 CSV preview: 511 increases, 79 decreases, 975 unchanged prices and 165 excluded plans. Products are matched exclusively by `plan_id`. Supplier costs and customer orders are never updated by this workflow.

Campaign: `corrected-2026-10-27-approved`. Source SHA-256: `28e9fd9004ecdaf328c18cded7aee06d7884c130b57a549b7c0b8f703fe7ec33`.

`scripts/apply-commercial-price-revision.mjs --apply` verifies the immutable private preview and baseline, current provider costs and identities, whole-dollar prices, the agreed conservative contribution assumptions, and the excluded IDs. Stripe prices are prepared in test/live without deleting older prices. Migration `20261027000200_commercial_price_revision.sql` atomically changes the catalog and both USD binding sets, stores the source hash and exclusions, and retains old/new price IDs in `pricing_campaign_changes`. Public and customer roles cannot execute it. Replays are no-ops; mismatched approvals, exclusions and stale baselines fail.

The six unverified Zimbabwe plans remain unpublished. Other excluded products retain their earlier price and publication status. The 29 capacity/duration warnings in the preview involve excluded products; none remain between eligible products. Currency checkout continues to derive amounts from the canonical USD prices while retaining immutable order-specific payment snapshots.

## Verification

- Local transaction tests cover mixed increases/decreases, 590-row batches, atomic rollback on stale input, exclusions, integer prices, public-role denial, history preservation and replay safety.
- Fourteen focused tests covering pricing, Stripe, checkout protection and currency snapshots passed. TypeScript and focused ESLint passed.
- Applied 590 changes. Independently compared all 1,730 catalog rows and 3,460 Stripe bindings against the baseline and approval; other fields, excluded prices and six publication suspensions were preserved.
- Verified unchanged immutable financial fields on the 19 pre-existing order-item records. No charges, eSIM issuance, emails, refunds or historical order writes were performed.

## Private audit and reversal records

`private-data/pricing/corrected-2026-10-27/` contains the original CSV, source digest, baseline catalog and Stripe bindings, prepared Stripe IDs, approved binding payload, execution result and independent verification. They are intentionally excluded from Git. The original approved preview remains available, and the execution manifest records approval and application separately.

For an owner-authorized reversal, read the campaign ledger and verify that current catalog/binding values still match this campaign before restoring its `old_cents`, `old_live_price_id` and `old_test_price_id` atomically. Restore corresponding product defaults and bundled retail data. Do not restore publication flags or re-enable the six suspended products as part of a price reversal. Do not change existing orders or remove the audit ledger or old Stripe prices.

Production release: commit 95cfe5c; Vercel dpl_HL9hKdCk4eeVDSPMAFXHFEXh2Zcc READY with www.mytripsim.com alias. Public browser verification showed Albania 100 MB / 7 days at USD 2; excluded 500 MB / 7 days remains USD 3. Stripe test/live defaults were aligned after the commit, and rerunning the operator workflow reported the revision already applied with no additional changes. Supabase linked migration dry-run returned up to date.
