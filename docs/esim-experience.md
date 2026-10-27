# Payment preparation and direct installation

Changes on 27 October 2026:

- Account pages show paid orders in preparation in the connections area instead of only an empty-state invitation to shop. The page refreshes every five seconds while preparation or a recent payment is pending, bounded to ten minutes and paused while hidden. A manual refresh remains available.
- The wallet also detects the publication race between its parallel account/profile and fulfillment reads: a ready/sent unit without its matching customer profile still triggers refresh until the profile is visible.
- Checkout delivery polling survives an initially empty list of units instead of stopping before enqueue visibility. It retains already opened private installation details across safe ready-state refreshes. Polling is bounded; manual retry is available afterwards.
- After a verified, successfully recorded live paid event, Next `after` wakes the existing leased fulfillment worker. It does not delay the webhook acknowledgment or bypass paid-order verification, immutable provider transaction IDs, leases, retry backoff or test-mode guards. The scheduled worker remains the recovery path. Provider allocation is still asynchronous; do not promise instant issuance.
- A shared direct-install component is shown with private installation details in the account and guest/checkout delivery page. It builds explicit HTTPS anchors on fixed Apple/Android setup hosts with a URL-encoded LPA value. No prefetch, redirect proxy, automatic navigation or analytics tracking is added; anchors suppress referrers. Existing authorization and manual/QR alternatives remain.

## Compatibility

[Apple supports carrier-link installation on iOS17.4 or later](https://support.apple.com/en-gb/118669). [eSIM Access documents Android universal links](https://esimaccess.com/new-android-universal-link-for-esim-installation/) with compatibility limits depending on device/browser. The UI recommends Chrome for Android and explains that QR/manual installation remains available if the OS installer does not open. This does not purchase the provider’s separate SDK or premium provisioning services.

Installation can start validity for installation-triggered plans, so the component tells customers to check plan conditions before continuing. Codes remain private and are sent to the official OS installer only when the customer chooses a button.

## Verification

17 tests passed across installation links/polling, wallet publication race, fulfillment, fulfillment security, customer isolation and live checkout. Link tests use synthetic credentials, verify exact decoded LPA and fixed hosts, and reject malformed input. ESLint, TypeScript and production build are checked. The real quick-install component was rendered locally with synthetic data and reviewed at desktop and390px; mobile buttons are48px high with no horizontal overflow.

No payment, real eSIM issuance, customer email or physical-device installation was performed for this change. Actual OS installation still requires a compatible device and valid unused customer profile; the web preview cannot prove that hardware step.

Production verification: commit5a9f3d5 deployed READY as dpl_ECeAsXZKXcEmWpwghNH7y97Pb387 and aliased to www.mytripsim.com. The public guest page renders the new preparation heading without private installation links. The wallet redirects anonymous visitors to login; unauthorized order lookup returns404 with private/no-store headers. Checkout remains live/enabled. No private account/profile was opened for this smoke test. Local visual fixture server stopped and viewport override reset.
