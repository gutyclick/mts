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
