# Visual traveler journey implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete a connected bilingual visual journey from destination and plan selection through checkout preview, example eSIM management, installation and a separate administration preview.

**Architecture:** Keep the existing Next server-rendered catalog and client islands. Add localized experience routes, pass one selected plan from the server, and use explicit fictional records for account/admin views. No database, provider, payment, email, authentication or provisioning calls.

**Tech Stack:** Existing Next App Router, TypeScript, React, Lucide, CSS, Playwright and local assets.

**Spec:** User-approved screen sequence in the conversation; visual direction and constraints below.

## Global constraints / design

- Existing Plus Jakarta Sans / Inter and palette: brand #1677FF, accessible action #126DE8, ink #14213D, sky #EDF5FF, orange #FF8A3D and border #DBE5EF.
- Signature: an illustrated travel pass with a perforated divider connects the selected plan, purchase preview and example eSIM detail. Utility screens stay quiet, readable and rounded.
- Desktop: content with a persistent summary column; mobile: one column, touch controls, existing safe-area dock and bottom sheets.
- Country catalog stays complete and without prices. No wholesale price fields, real customer data, editable payment fields, usable QR codes or pretend purchases.
- New checkout, account and admin pages explicitly disclose demonstration mode and use noindex. Unknown networks, regional membership and activation rules stay unverified.
- English and Spanish paths and equivalent-language links must preserve destination and selected plan context.
- New user-supplied destination banners may be synchronized by the existing prebuild script; preserve original image files.

## Review focus

- Invalid/mismatched destination and plan IDs return 404 rather than silently selecting another product.
- Switching locale preserves plan and experience context; region plans do not invent included countries.
- Preview completion must never claim payment or issuance; no sensitive information can be submitted.
- Empty/loading/error views are explicit examples and recover to the normal demo.
- At 320px and landscape, summaries and account/admin tables fit without page overflow; keyboard navigation remains visible.

## Task 1: Destination and selected-plan detail

**Files:** `src/lib/experience-routes.ts`, `src/lib/experience-copy.ts`, `src/components/experience/plan-detail.tsx`, `src/components/experience/destination-overview.tsx`, `src/app/[locale]/plan/[slug]/[planId]/page.tsx`, existing catalog components and `src/styles/experience.css`.

- [ ] Define localized paths and selected-plan route without putting the full plan catalog in a client bundle.
- [ ] Add destination section navigation, allowance/duration range and honest coverage/activation details.
- [ ] Keep quick-look dialog and add a full detail link; build a travel-pass summary and expandable conditions.
- [ ] Verify exact plan identity, malformed paths, fixed/daily labels and regional unknowns.

## Task 2: Checkout preview and eSIM views

**Files:** `src/components/experience/checkout-preview.tsx`, `src/components/experience/esim-wallet.tsx`, `src/components/experience/install-guide.tsx`, `src/components/experience/shared.tsx`, `src/components/experience/experience-page.tsx`, `src/lib/demo-esims.ts`, generic localized page route and navigation.

- [ ] Add connected review/payment-layout/completion preview using read-only fictional buyer information and no payment entry.
- [ ] Add wallet status filters and details, sample allowance meter, non-scannable QR illustration and installation links.
- [ ] Add selectable iPhone/Android instruction views referencing confirmed provider FAQ; activation timing remains per-plan.
- [ ] Add recoverable loading/empty/error examples and keyboard-friendly interactions.
- [ ] Verify no purchase/provider requests, no payment fields or real identifiers, and successful connected navigation.

## Task 3: Administration and polish

**Files:** `src/components/experience/admin-preview.tsx`, documentation, tests and capture/audit scripts.

- [ ] Build a separate clearly labeled admin preview with destination search, plan review, content/FAQ and fictional order views, without claiming access control.
- [ ] Verify bilingual navigation, responsive layouts, touch targets and scoped axe checks on all new screens and states.
- [ ] Run build, lint, typecheck, unit/browser tests and secret scan; capture/review desktop/mobile screens.
- [ ] Commit authorized changes, push to the existing repository and confirm Vercel deployment.
