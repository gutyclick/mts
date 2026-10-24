# Plan information and device compatibility

Reviewed on 2026-10-24. Destination and existing plan links use the same selector with full details, coverage and conditions visible together. No plan-details tabs or intermediate plan dialog are required. The reusable compatibility dialog is also accessible from the compatibility guide, with brand, searchable model, purchase-region/device checks and result stages. Native modal focus containment, Escape, focus restoration and body scroll restoration are supported. Mobile uses the full viewport with safe-area padding; no device identifiers are collected or persisted. The model search uses one visible focus ring around the whole field; instructions can be expanded when needed. Choosing another brand/model clears previous device-check answers.

## Evidence policy

`src/lib/device-compatibility.ts` separates supplier candidates from manufacturer evidence. A name in the supplier's attachment is not confirmation. Unreviewed models are labelled as awaiting confirmation. An absent model never means incompatible. A qualified positive result requires documented model/family support, a reviewed purchase market where applicable, and affirmative user answers about carrier unlock and Add eSIM. This is guidance, not automatic device detection or a provider provisioning guarantee.

- [Apple iPhone setup](https://support.apple.com/en-us/118669): XS/XR and newer, with regional exceptions. Corrected “iPhone 17 Air” to “iPhone Air”. China and Hong Kong/Macao results stay manual because exact regional variants matter.
- [Apple China mainland](https://support.apple.com/en-ie/123879): foreign carrier profiles cannot be installed while located in mainland China on the relevant mainland-purchased devices. Avoided the attachment's obsolete blanket exclusion.
- [Apple iPad setup](https://support.apple.com/en-gb/119592): cellular generations matching the supplied list, not Wi-Fi-only tablets. Omitted supplier model-number pairings pending exact SKU confirmation.
- [Google Pixel](https://support.google.com/pixelphone/answer/7086887?hl=en): Pixel 4 and newer family support; Pixel 3 country/carrier and Pixel 3a Japan/Verizon exceptions. No blanket Hong Kong exclusion.
- [Samsung UK](https://www.samsung.com/uk/mobile-phone-buying-guide/what-is-an-esim/): S20–S25, Fold/Flip, selected A models with market restrictions. [Samsung Australia](https://www.samsung.com/au/support/mobile-devices/esim-compatibility/) supplies Note20 evidence. Other purchase markets receive a review result. A74 remains unverified.
- [Xiaomi](https://www.mi.com/global/support/faq/details/KA-535492/): 14T, 14T Pro, 15, 15 Ultra. [Redmi Note 13 Pro 5G Malaysia](https://www.mi.com/my/support/faq/details/KA-256842/): regional support. The attachment's other China-model claims remain unverified.
- [OPPO Find X8 Pro](https://www.oppo.com/es/smartphones/series-find-x/find-x8-pro/specs/): CPH2659 Spanish specification. Other OPPO entries remain candidates.
- [OnePlus 13 US](https://www.oneplus.com/us/13/specs): explicitly lists eSIM. [OnePlus 13R US](https://www.oneplus.com/us/13r/specs): describes dual nano-SIM without confirming eSIM; always manual, never a positive result from this evidence.
- [HONOR Magic6 Pro UK](https://www.honor.com/uk/phones/honor-magic6-pro/spec/): eSIM variants documented.
- [Sony Xperia 1 V UK](https://www.sony.co.uk/electronics/support/mobile-phones-tablets-mobile-phones/xperia-1-v-256gb/specifications): regional eSIM specification.

Other supplied brands and models remain selectable with explicit pending status. The supplier's Huawei P50 Pro entries contradict one another, broad Xperia 5/Edge family labels lack exact models, and some names/SKUs may be inaccurate. They are not approved without primary evidence. This is an intentionally incomplete evidence registry, not a claim to list every compatible device currently sold. Recheck the relevant manufacturer documentation before expanding confirmed coverage.

Plan information uses the catalog's fixed allowance and duration. Network names, activation triggers and exact regional country membership remain pending until the provider supplies them. Reference-image claims about unlimited data, Always On, savings and speeds were not adopted without evidence. Purchase remains a visual preview.
