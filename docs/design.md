# MyTripSim — first public release

## Scope and direction

Implement the supplied development brief directly in an empty repository. Public bilingual Next.js App Router website; English is the default. No payments, provisioning, authentication, or admin dashboard.

White, blue #087CF5, orange #FF8438, ink #101828, muted #667085, surface #F5F9FC. Plus Jakarta Sans headings and Inter UI. A spacious two-column hero combines a strong headline with a reusable original SVG traveler-cat placeholder. Photography appears only in destination cards. Components share restrained borders, 12–20px radii, visible focus, and compact icons.

## Architecture

Server-rendered locale layouts and content pages; client islands for search, navigation, plan filtering and details. Central dictionaries and explicit localized route mapping. Typed mock catalog independent of UI. Integration contracts define future supplier, checkout, and delivery boundaries without executable external connections.

## Delivery sequence

- [x] Initialize framework, tooling, design tokens and reusable layout.
- [x] Add dictionaries, localized paths, catalog and search behavior.
- [x] Build homepage sections, destination index, destination plans and detail dialog.
- [x] Add localized how-it-works, compatibility, help and draft legal pages.
- [x] Add metadata, alternates, sitemap, robots and truthful organization schema.
- [x] Verify lint, type checking, production build, responsive layouts and keyboard flows.
- [x] Document setup, asset provenance, commercial limitations and integration work.

## Review conditions

Cross-language aliases and accent-insensitive search; equivalent-page language switching; empty filters; unknown locale/destination returning 404; checkout never charging or showing purchase success; 360px layout without horizontal overflow; keyboard focus recovery in the plan dialog.
