# Verification — 2026-10-23

## SIM mascot illustrations — 2026-10-24

The supplied transparent PNG illustrations are now mapped through a shared `SimMascot` image component: Traveler replaces the old hero character, Help accompanies the FAQ directory heading, and Adventurer sits in the centered How it works heading. The source file `sim_adeventurer.png` retains its existing spelling. Original images are unmodified; `next/image` supplies responsive sources with intrinsic dimensions and localized alternative text. The home hero uses a simple backdrop and compact status label instead of duplicating the illustration's own travel symbols. On phones, its compact image/status row keeps destination search first. FAQ topic pages retain their independent question layout.

Production build including TypeScript, lint and formatting passed. All twenty existing site/FAQ desktop/mobile browser scenarios passed. A focused audit of the six localized home, FAQ-directory and How it works pages returned no findings across seven widths (320–1440px), with axe WCAG A/AA checks at 360/1440px including FAQ search results. Reviewed the [Traveler hero](previews/home-desktop.png), [compact mobile hero](previews/mobile-app.png), [Help FAQ heading](previews/faq-desktop.png) and [Adventurer heading](previews/how-mobile.png). No additional services or credentials were introduced.

## Organized How it works page — 2026-10-24

The localized How it works page now has a dedicated server-rendered layout and scoped styles. A centered introduction, a numbered three-card sequence and a preparation panel share one bounded reading grid. Preparation groups the checklist with compatibility/installation links, and the destination/FAQ actions sit together in one footer row (stacked at phone widths). Long checklist and card text stay left-aligned for reading. The home page's shared Steps component and the existing metadata/routes remain in place.

Production build including TypeScript, lint and formatting passed. All ten existing site browser scenarios passed on desktop/mobile, including locale navigation, public route responses, FAQ navigation and responsive checks. A focused audit of both localized How it works pages and both home pages returned no findings at seven widths (320–1440px), with axe WCAG A/AA checks at 360/1440px. Reviewed [desktop](previews/how-desktop.png), [tablet](previews/how-tablet.png), [phone](previews/how-mobile.png) and [phone preparation panel](previews/how-mobile-preparation.png). No backend integration or commercial data was introduced.

## Separate FAQ topic pages — 2026-10-24

The FAQ home is now a six-topic directory instead of an inline category filter. Each topic has an independent localized URL, heading, breadcrumb, scoped search and native answer disclosures. The desktop sidebar becomes a horizontal topic navigator on phones, with the current topic brought into view without moving the page vertically. Global search returns links to answers on their topic pages. Feedback, copyable summaries and related answers preserve stable question IDs. Help, installation and compatibility links now target the new routes directly; old FAQ home category/question fragments resolve to their appropriate topic page. Localized canonical/hreflang/Open Graph entries and sitemap URLs cover all twelve topic pages.

The final production build (including TypeScript), lint, formatting and sixteen data tests passed. All 56 desktop/mobile browser scenarios passed, including all twelve topic routes, cross-language navigation, legacy category/question links, global/scoped search, cross-topic related answers, feedback persistence, clipboard fallback, independent page contents/metadata, sitemap entries and invalid-route 404s. The responsive audit returned no findings across sixteen routes and seven widths (320–1440px); axe checks at 360/1440px include FAQ index search results, expanded topic answers and more-help states. Reviewed the [FAQ directory](previews/faq-desktop.png), [desktop topic page](previews/faq-topic-desktop.png) and [mobile topic page](previews/faq-topic-mobile.png).

The six additional destination banners present at build time were synchronized (32 mapped banners total). Other unreferenced user assets remain untouched. No prices, credentials or backend services were added.

## Compact country pages, coverage tables and destination guides — 2026-10-24

The plan selector and purchase-preview summary now sit together above full coverage/conditions cards. Both parts follow the selected variant without tab navigation. Coverage uses compact shaded facts and semantic operator/network tables; regional tables retain exact destination grouping, qualified source differences and focusable scrolling. Conditions have consistent decorative icons. Localized server-rendered guides add catalog ranges/counts, preparation steps and destination-specific FAQs, plus original metadata derived from the same catalog. See [content and layout criteria](destination-experience.md).

Production build, lint, TypeScript (during build), formatting and all fifteen data tests passed. The full desktop/mobile suite passed 52 of 54 scenarios on its first run; the remaining two found ambiguous test selectors after FAQ text introduced the same coverage label. After scoping those selectors to native summaries, all six focused network scenarios passed, covering both previously failing scenarios. The two new guide scenarios passed on desktop and mobile, checking country-specific operators, keyboard FAQ activation, metadata, icons, table headings and detail placement below the compact summary.

The responsive audit returned no findings across fourteen routes and seven widths (320–1440px). Scoped axe WCAG A/AA checks at 360/1440px include the new expanded destination FAQ and expanded regional coverage/network tables, alongside existing selection, empty-result, onboarding and traveler states. Reviewed [desktop detail cards](previews/plans-desktop-information.png), [mobile detail cards](previews/plans-mobile-information.png), [destination guide](previews/plans-desktop-guide.png) and [mobile regional table](previews/regional-networks-mobile-table.png). Capture scripts preserve these states for future review. Anguilla and Antigua and Barbuda banners supplied by the user were synchronized. No prices, payments, credentials or Supabase integration were added.

## Provider plan metadata without commercial fields — 2026-10-24

The additional CSV enriches all 1,730 existing fixed products through exact identifiers, with no new/daily products or commercial values. Operators, plan/operator technology, explicit regional country coverage, activation trigger, top-up policy, APN and the supplied fair-use limitation are projected into a separate server-side detail registry. Original quantities/durations are preserved, including 120 sub-GB products rounded to zero in the new file's numeric column. The UI flags 229 plan/operator technology differences and preserves the provider's legacy AN label for confirmation instead of silently converting it to Curaçao. Ambiguous validity and supplier internal IDs/IPs are excluded. See [field mapping and source limitations](plan-enrichment.md).

Build, lint, TypeScript, formatting and all fifteen unit tests passed. All 52 desktop/mobile browser scenarios passed. Six focused network scenarios were repeated after adding explicit legacy-region coverage and passed, checking exact per-variant operators/APN, activation, regional lists/flags, commercial-field absence, technology qualifications and fixed 75 GB fair-use wording. The responsive audit returned no findings across fourteen routes at seven widths. Scoped axe checks at 360/1440px now include expanded regional country/operator lists with keyboard-focusable scroll areas, alongside the existing catalog/checkout/FAQ/wallet/checker states.

Reviewed the updated [selected plan](previews/plan-detail-desktop.png), [regional coverage on mobile](previews/regional-networks-mobile-expanded.png) and [regional operators on desktop](previews/regional-networks-desktop-expanded.png). No payment, activation or real top-up integration was added. The provider CSV stays outside the repository; generated data has an explicit field allowlist and monetary-content checks.

## One-screen plan selection and cleaner onboarding — 2026-10-24

Destination pages and existing plan links now share a compact radio selector and a complete, initially visible plan sheet. GB/day ordering is numeric with deterministic tie-breaks; filters, selected data/duration, conditions and purchase-preview links update together. Selection survives reload and locale changes through the URL. Distinct products with equal data/duration remain selectable and are labelled with stable variant numbers. Empty filters remove the purchase-preview link. Intermediate plan dialogs and plan-information tabs were removed. The supplied Germany banner was synchronized, bringing mapped banners to nineteen.

The checker has a single search-field focus ring, less repeated copy, optional setup instructions and separate scrollable content/footer areas so actions do not cover choices. Changing the brand/model clears old region/unlock/eSIM answers. The source-based compatibility rules are unchanged.

Production build, lint, TypeScript, formatting and eleven unit tests passed. The full 46-scenario desktop/mobile browser suite passed, including sorting, inline selection, reload/translation, invalid/old plan routes, no stale purchase links, focus styling, answer reset and footer/content separation. After the final heading-weight and shortened filter-option polish, the production build, sixteen focused catalog/selection browser scenarios and a scoped product audit passed again. The main responsive/axe audit returned no findings across thirteen routes/seven widths, including selected/empty plans and all checker stages; the final scoped check covered Japan in both languages and a regional destination at 320/390/768/1440px, with selected axe A/AA checks at 390/1440px and no findings.

Reviewed [desktop selection](previews/plans-desktop.png), [mobile selection](previews/plans-mobile.png), [inline mobile sheet](previews/mobile-plan-selection.png), and the [focused mobile model search](previews/plan-detail-mobile-compatibility-search.png). Physical-device checks on iOS Safari and Android Chrome remain recommended; browser emulation does not validate real keyboards or device eSIM provisioning.

## Plan information and device onboarding — 2026-10-24

The full plan page now has accessible Details/Coverage tabs and a compatibility checker, shared with the compatibility guide. The candidate registry contains 223 model entries across 20 brand groups; 110 have model/family manufacturer evidence, while all remaining candidates explicitly require confirmation. Documented support is distinct from a guarantee for a specific device. See [research and evidence rules](device-compatibility.md).

The final production build, ESLint, TypeScript, formatting and all ten unit tests passed. All 40 desktop/mobile browser scenarios passed, including tab keyboard controls, complete documented-model guidance, unknown models, carrier locks, modal focus restoration, Escape, body scroll restoration and Spanish onboarding at 320px. The responsive audit across thirteen routes at seven viewport widths returned no findings. Scoped axe checks at 360/1440px now include all four onboarding stages, in addition to the existing page/FAQ/checkout/wallet states.

Visually reviewed [desktop plan information](previews/plan-detail-desktop.png), [desktop checker](previews/plan-detail-desktop-compatibility.png) and [mobile checker](previews/plan-detail-mobile-compatibility.png). No backend, device identifiers, purchases or activation requests were added. The existing fixed-only catalog and hidden prices are unchanged.

Environment: Windows, Node.js 24.15.0, Next.js 16.4.3, production server on port 3000. Microsoft Edge was used for desktop and emulated mobile browser checks.

| Check                  | Result                                                                        |
| ---------------------- | ----------------------------------------------------------------------------- |
| `npm run lint`         | Exit 0, no errors or warnings                                                 |
| `npm run typecheck`    | Exit 0                                                                        |
| `npm run format:check` | All matched files formatted                                                   |
| `npm test`             | 4 passed, 0 failed                                                            |
| `npm run build`        | Exit 0                                                                        |
| `npm run test:e2e`     | 10 passed, 0 failed                                                           |
| `npm run audit:ui`     | No reported violations or horizontal overflow in the audited scenarios        |
| `npm run capture`      | Desktop home, Spanish mobile home, and destination plan screenshots generated |

Browser flows cover localized search with keyboard and trip duration, switching language and document language, filtering and empty states, plan details, inactive checkout, Escape and restored focus, FAQ, public routes, invalid destinations/locales, canonical/hreflang, image loading, mobile menu and overflow.

The UI audit checks five representative routes at 360, 768, 1024 and 1440 px for horizontal overflow. It runs selected WCAG 2 A/AA and 2.1 A/AA axe rules at 360 and 1440 px. This is scoped automated evidence, not accessibility certification, field Core Web Vitals measurements, or validation on physical mobile devices.

Visual previews:

- [Desktop homepage](previews/home-desktop.png)
- [Spanish mobile homepage](previews/home-mobile.png)
- [Destination and plans](previews/plans-desktop.png)

No live payments, provider purchases, production deployment, or eSIM provisioning occurred.

## Visual refinement verification

The refined production build passed lint, TypeScript, Prettier, 4 catalog tests and 10 desktop/mobile browser scenarios. The responsive browser flow now also verifies that the sticky header stays at viewport top after scrolling. Search, trip-duration filtering, equivalent locale routes, FAQ, plan details, inactive checkout and focus restoration continue to pass.

The repeated UI audit returned no findings for its scoped contrast/accessibility rules at 360 and 1440 px or overflow checks at 360, 768, 1024 and 1440 px. The preview images above were regenerated from the production server after the update. The reusable destination and hero image slots use original provisional illustrations; the six destination SVG assets share one visual direction and the hero retains the original traveler-cat asset.

The brand blue remains `#1677FF`; buttons with small white labels use `#126DE8` to meet text contrast in the audited states. No external services, credentials, payments or database access were introduced by this refinement.

## Mobile browser verification

The mobile shell production build passed lint, TypeScript, formatting, 4 catalog tests and 18 browser scenarios. Added coverage verifies active localized bottom tabs, 44px minimum tab targets, footer clearance, navigation hidden on desktop, search with a short viewport, dock recovery with the input still focused, and a bottom-aligned plan sheet with background scroll locking and focus restoration.

Overflow checks now cover 320, 360, 390, 430, 768, 1024 and 1440px; browser flows also cover 844×390 landscape. The scoped axe audit returned no findings. Physical iOS/Android keyboard behavior remains a device-testing step; reduced-viewport emulation verifies the implemented layout and viewport response without claiming a full device certification.

Updated previews: [phone home](previews/mobile-app.png), [phone plans](previews/plans-mobile.png), [tablet](previews/tablet-home.png) and [plan sheet](previews/mobile-plan-sheet.png). The original desktop composition remains unchanged.

## Imported catalog and independent FAQ

The catalog update passed a production build, ESLint, TypeScript, four updated catalog tests and all 18 desktop/mobile browser scenarios. Catalog checks assert 244 destinations (202 countries/territories and 42 regions), all 3,186 unique source plans, an explicit field allowlist without prices, existing images, real filters and 24 FAQ questions per language. Browser checks verify all 43 Japan plans, no currency amounts in their page or detail, intersecting filters, FAQ search, route localization and responsive navigation.

The updated audit covered seven representative routes at 320, 360, 390, 430, 768, 1024 and 1440px, including FAQ and help. It returned no horizontal overflow or selected axe WCAG A/AA findings. Screenshots were generated from this production build and visually reviewed: [desktop FAQ](previews/faq-desktop.png), [mobile FAQ](previews/faq-mobile.png), [mobile directory](previews/directory-mobile.png), [destination banner](previews/plans-desktop.png) and [mobile detail](previews/mobile-plan-sheet.png).

The CSV itself remains outside the repository. The imported data contains plan identifiers, original names, allowance, duration, type and coverage code only. There are no payment or provider API calls and no Supabase credentials in this change. Image synchronization matched the four supplied destination banners; local MIT-licensed Circle Flags cover the 202 country/territory entries.

## Provider FAQ and local feedback

The expanded FAQ contains 29 questions per language with stable translated IDs, six illustrated topic selectors, procedural steps and provider-specific policies for roaming, hotspot, single-device QR installation and the Japan iPhone APN exception. Wi-Fi Calling and stored eSIM capacity remain qualified by device and carrier support. See [content sources and feedback behavior](faq-experience.md).

The production build, ESLint, TypeScript and five catalog/content tests passed. All 26 browser scenarios passed; after correcting text encoding, the eight FAQ scenarios were rerun against the final build and passed. They cover direct article links, topic/search filtering, persistent choices across reloads and languages, related-answer navigation and focus, blocked storage, clipboard success and manual-copy fallback. Content checks also reject encoding replacement marks in answer text and malformed Spanish question openings.

The refreshed responsive/axe audit includes the expanded hotspot answer and “more help” states at 360 and 1440px. It returned no findings. Visual review covered [mobile answer](previews/faq-mobile-answer.png), [mobile next steps](previews/faq-mobile-help.png), [desktop answer](previews/faq-desktop-answer.png) and [desktop next steps](previews/faq-desktop-help.png).

The user confirmed there is no support contact or connected Supabase yet. Votes remain in the browser, with clear wording that they are not sent to the team. More help provides related answers and a copyable question without creating support tickets. No contact details, activation secrets or analytics backend were invented. The image sync also picked up the five additional user-supplied banners for Argentina, Brazil, Colombia, Panama and Peru.

## Connected visual journey — 2026-10-24

The visual skeleton adds full plan details, a review/payment/confirmation preview, a fictional three-trip wallet and detail views, iPhone/Android installation steps, and a separate public administration sample. Plan identity and locale query context are preserved. Checkout/account/admin screens are noindex and never request payment details, submit personal data, create orders or provision eSIMs.

Validation: production build, ESLint, TypeScript, formatting and six unit tests passed. The final 34 desktop/mobile browser scenarios passed. Added coverage includes the end-to-end visual journey without mutation requests, read-only traveler placeholders, confirmation wording, wallet filters/recovery states, installation device tabs, administration search, unknown/mismatched plan 404s, translated query context, noindex metadata and new-screen overflow checks from 320 to 1440px.

The extended audit checks thirteen routes at 320, 360, 390, 430, 768, 1024 and 1440px. Selected axe A/AA checks at 360 and 1440px include payment/confirmation and wallet empty/loading/error states. Initial findings in mobile administration sizing and wallet accessible filter names were corrected; the repeated audit returned no findings.

Reviewed previews: [plan detail](previews/plan-detail-mobile.png), [checkout](previews/checkout-desktop.png), [payment layout](previews/checkout-mobile-payment.png), [confirmation](previews/checkout-mobile-confirmation.png), [wallet](previews/wallet-desktop.png), [eSIM detail](previews/esim-detail-mobile.png), [installation](previews/install-mobile.png) and [administration](previews/studio-mobile.png). New banners for Mexico, Paraguay and Uruguay are linked by the existing image synchronization.

An independent read-only review found no critical or important issues in the visual scope and additionally checked the new screens and administration tabs at 844×390. Its copied-language-link observation was reproduced with a failing href assertion and corrected so the selected plan is present in the rendered anchor, not only click handlers. The final production build and complete 34-scenario browser suite passed after this fix. Six additional supplied images were synchronized, bringing mapped banners to 18; all mapped files passed image metadata validation.

## Fixed data plans only — 2026-10-24

The user requested removal of all daily data packages. The catalog now contains exactly 1,730 fixed plans; 1,456 daily/FUP packages were excluded from the data files and future imports. Three regional packages without fixed alternatives were removed, leaving 241 destinations (202 countries/territories and 39 regions). Japan now has 23 plans. The administration counters derive from the generated summary rather than hardcoded totals.

The daily filter, daily plan rendering, daily allowance/FUP product copy and conditions were removed. The FAQ now states that daily packages are not offered. Old daily plan/detail/checkout URLs and daily-only regional destinations return 404 and are absent from the sitemap.

Verification: the original CSV's fixed-plan identifier set matches the published catalog exactly, with no missing or unexpected plans and no daily identifiers remaining. Seven unit tests passed, including an isolated re-import that excludes daily packages and empty regions while preserving fixed plans with one-day validity. Build, ESLint, TypeScript and formatting passed. The complete 34 desktop/mobile browser scenarios passed after updating the empty-filter scenario to use an available fixed-plan duration. The scoped responsive/axe audit returned no findings and screenshots were refreshed.
