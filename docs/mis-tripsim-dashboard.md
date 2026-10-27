# Mis TripSim customer workspace

The customer area keeps its existing URLs and is now named Mis TripSim / My TripSim. It uses the existing Jakarta/Inter typography, blue `#1677ff`, action blue `#0d5bd7`, orange `#ff8a3d`, ink `#0f172a`, pale surface `#f4f8fc` and white cards.

Desktop uses a compact left navigation and one content panel. Mobile uses four equal navigation items and a single card column. The four sections are connections, orders, support and account. Connections lead with installation-ready records, then active, suspended and expired records. Filters separate ready, active and past eSIMs; preparation cards and automatic delivery refresh remain available.

Cards keep destination, exact purchased plan, allowance, validity, status, optional recorded usage and one main action. Usage is explicitly the latest saved reading, not a live balance. Private installation details and quick-install actions retain the owner checks and their existing detail route.

Support is rendered only in its own section. The global floating chat is omitted on the wallet route, and a single inline chat trigger is offered within Support alongside ticket history and installation/FAQ resources. Ticket summaries select actual escalations rather than resolved AI conversations. Empty ticket history and load failures are distinct states.

Account contains names, email, sign-out and the authorized administration link. Login redirects preserve only recognized section/filter values and retain existing protections against external redirects. No new customer data API, database migration or profile mutation is introduced.

Validation includes pure navigation/filter tests, customer ownership and redirect protections, installation/delivery polling regression tests, focused support tests, TypeScript, ESLint and production compilation. Synthetic visual QA at desktop and 390px checked the four sections, active filter, recorded usage, single support summary and absence of horizontal overflow. Synthetic fixtures remain private and are never deployed.

Production QA confirmed that the connection screen has no support summary or floating chat; Orders contains its six existing order records without support UI; Support has exactly one ticket summary and one inline chat trigger without load errors; Account has the three profile fields and sign-out without ticket UI. A follow-up regression fix prevents paid test-mode orders from appearing as real eSIM preparation or driving automatic refresh. Fourteen focused tests passed. Synthetic layout checks passed at 320px and 390px without horizontal overflow.
