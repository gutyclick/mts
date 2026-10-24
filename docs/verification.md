# Verification — 2026-10-23

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
