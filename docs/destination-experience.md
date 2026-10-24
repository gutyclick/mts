# Country and regional eSIM pages

Each destination has one plan-selection page in English and Spanish. Selection, filtering and ordering remain on the same page. Existing direct plan links reuse it.

The first row pairs the compact radio selector with a purchase-preview summary: current allowance and duration, device checker and preview action. Full coverage and conditions follow immediately below in two cards, stacked on phones. The selected plan updates both parts together. Empty results remove both the summary action and the detail sheet.

Coverage uses shaded label/value cells and a semantic operator/network table. Regional tables include destination row groups, bounded keyboard-focusable scrolling and an explicit country list. Table headers and text identify columns independently of color. Provider technology disagreements, unresolved legacy AN coverage and APN instructions remain qualified. Conditions use consistent Lucide icons, short labels and separated rows; all icons beside text are decorative.

Below the selected plan, a server-rendered destination guide includes actual allowance/duration ranges, plan count, three preparation steps and six native FAQ disclosures. `src/lib/destination-content.ts` derives the summary and localized metadata from that destination's fixed plans. Operator names are a destination-specific union across variants, explicitly qualified rather than promised for every plan. Regional FAQs direct visitors to the selected plan's exact coverage. The guide stays visible when filters have no results because it describes the whole destination catalog.

The layout uses the supplied merchant reference as inspiration for hierarchy only. Copy is original and uses the supplied provider facts. No prices, unlimited-data claims, reviews, savings, guaranteed speeds, invented support availability or real purchase functionality are added. There is no FAQ rich-result promise. Google recommends [helpful, original content for people](https://developers.google.com/search/docs/fundamentals/creating-helpful-content); country names alone are not a substitute for useful country-specific information.

Before a public commercial launch, verify technical conditions with the provider, test the journey on physical iOS Safari and Android Chrome devices, review representative local/regional variants, and confirm the production domain and Search Console indexing setup. Supabase and payment/provisioning remain a later phase.
