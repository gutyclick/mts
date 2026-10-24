# Mobile browser experience

Preserve the approved brand, desktop composition, routes and catalog. Improve phone/tablet use as a browser-based travel app without adding accounts, fake order tabs, payment behavior, offline promises or native-app infrastructure.

- Localized bottom navigation links to real Home, Destinations, Guide and Help pages; destination detail routes keep the destination tab active. Desktop navigation is unchanged.
- Safe-area aware shell and viewport; reserve space for the bottom navigation so content and footer remain reachable. While editing, a substantial visual-viewport height reduction hides the dock; restoring the height brings it back even if the input retains focus. Focus alone does not hide navigation when using a hardware keyboard.
- Phone hero retains a compact mascot travel card, with readable copy and full-width destination/duration fields. Inputs use 16px type to avoid iOS focus zoom; primary controls are at least 44–48px tall.
- Sticky directory search, larger result rows, readable destination cards and one-column plan summaries on phones.
- Native plan dialog becomes a scrollable bottom sheet with safe-area padding. Lock background scrolling while open and restore it and focus when closed.
- Keep pinch zoom enabled and reduced-motion support. No service worker or install prompt is needed for this visual refinement.

Validation covers phone widths 320–430px, portrait tablet, desktop, active navigation, language switching, filtered plans, small visual viewport with focused input, bottom-sheet geometry, scroll/focus restoration and footer clearance. Browser viewport emulation does not replace testing physical devices and their keyboards.

Preview assets: [phone home](previews/mobile-app.png), [tablet](previews/tablet-home.png), [phone plans](previews/plans-mobile.png), [plan bottom sheet](previews/mobile-plan-sheet.png).
