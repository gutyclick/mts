# Mobile browser experience

Preserve the approved brand, desktop composition, routes and catalog. Improve phone/tablet use as a browser-based travel app without adding accounts, fake order tabs, payment behavior, offline promises or native-app infrastructure.

- Localized bottom navigation links to real Home, Destinations, Guide and Help pages; destination detail routes keep the destination tab active. Desktop navigation is unchanged.
- Safe-area aware shell and viewport; reserve space for the bottom navigation so content and footer remain reachable. While editing, a substantial visual-viewport height reduction hides the dock; restoring the height brings it back even if the input retains focus. Focus alone does not hide navigation when using a hardware keyboard.
- Phone hero retains a compact mascot travel card, with readable copy and full-width destination/duration fields. Inputs use 16px type to avoid iOS focus zoom; primary controls are at least 44–48px tall.
- Sticky directory search, larger result rows, readable destination cards and one-column plan summaries on phones.
- Plan options are compact native radio rows in a bounded scroll area. The selected plan's full details appear directly underneath, with a local jump link and no intermediate dialog. The compatibility checker alone uses a full-screen mobile dialog with safe-area padding and restored background scroll/focus when closed.
- Keep pinch zoom enabled and reduced-motion support. No service worker or install prompt is needed for this visual refinement.

Validation covers phone widths 320–430px, portrait tablet, desktop, active navigation, language switching, filtered/sorted plans, inline detail selection, small visual viewport with focused input, compatibility dialog scroll/focus restoration and footer clearance. Browser viewport emulation does not replace testing physical devices and their keyboards.

Preview assets: [phone home](previews/mobile-app.png), [tablet](previews/tablet-home.png), [phone plans](previews/plans-mobile.png), [inline plan details](previews/mobile-plan-selection.png).
