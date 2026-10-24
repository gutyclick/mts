// Manufacturer evidence is deliberately separate from the supplier's candidate list.
// A candidate without evidence must never produce a positive compatibility result.
export const reviewedOn = "2026-10-24";
export const deviceSources = {
  apple: {
    label: "Apple · iPhone eSIM",
    url: "https://support.apple.com/en-us/118669",
  },
  appleChina: {
    label: "Apple · China mainland",
    url: "https://support.apple.com/en-ie/123879",
  },
  google: {
    label: "Google · Pixel eSIM",
    url: "https://support.google.com/pixelphone/answer/7086887?hl=en",
  },
  samsung: {
    label: "Samsung · Galaxy (UK)",
    url: "https://www.samsung.com/uk/mobile-phone-buying-guide/what-is-an-esim/",
  },
  samsungAU: {
    label: "Samsung · Galaxy (Australia)",
    url: "https://www.samsung.com/au/support/mobile-devices/esim-compatibility/",
  },
  xiaomi: {
    label: "Xiaomi · eSIM",
    url: "https://www.mi.com/global/support/faq/details/KA-535492/",
  },
  redmi: {
    label: "Xiaomi · Redmi Note 13 Pro 5G (Malaysia)",
    url: "https://www.mi.com/my/support/faq/details/KA-256842/",
  },
  oppo: {
    label: "OPPO · Find X8 Pro CPH2659 (Spain)",
    url: "https://www.oppo.com/es/smartphones/series-find-x/find-x8-pro/specs/",
  },
  oneplus: {
    label: "OnePlus · 13R specifications (US)",
    url: "https://www.oneplus.com/us/13r/specs",
  },
  oneplus13: {
    label: "OnePlus · 13 specifications (US)",
    url: "https://www.oneplus.com/us/13/specs",
  },
  ipad: {
    label: "Apple · iPad eSIM",
    url: "https://support.apple.com/en-gb/119592",
  },
  honor: {
    label: "HONOR · Magic6 Pro (UK)",
    url: "https://www.honor.com/uk/phones/honor-magic6-pro/spec/",
  },
  sony: {
    label: "Sony · Xperia 1 V (UK)",
    url: "https://www.sony.co.uk/electronics/support/mobile-phones-tablets-mobile-phones/xperia-1-v-256gb/specifications",
  },
} as const;
export type SourceKey = keyof typeof deviceSources;
export type Device = { name: string; source?: SourceKey; regions?: string[] };
export type DeviceBrand = { name: string; models: Device[] };
const models = (
  names: string[],
  source?: SourceKey,
  regions?: string[],
): Device[] => names.map((name) => ({ name, source, regions }));
export const deviceBrands: DeviceBrand[] = [
  {
    name: "Apple · iPhone",
    models: models(
      [
        "iPhone 17 Pro Max",
        "iPhone 17 Pro",
        "iPhone Air",
        "iPhone 17",
        "iPhone 16e",
        "iPhone 16 Pro Max",
        "iPhone 16 Plus",
        "iPhone 16 Pro",
        "iPhone 16",
        "iPhone 15 Pro Max",
        "iPhone 15 Plus",
        "iPhone 15 Pro",
        "iPhone 15",
        "iPhone 14 Pro Max",
        "iPhone 14 Plus",
        "iPhone 14 Pro",
        "iPhone 14",
        "iPhone SE (2022)",
        "iPhone 13 Pro Max",
        "iPhone 13 Pro",
        "iPhone 13 mini",
        "iPhone 13",
        "iPhone 12 Pro Max",
        "iPhone 12 Pro",
        "iPhone 12 mini",
        "iPhone 12",
        "iPhone SE (2020)",
        "iPhone 11 Pro Max",
        "iPhone 11 Pro",
        "iPhone 11",
        "iPhone XS Max",
        "iPhone XS",
        "iPhone XR",
      ],
      "apple",
    ),
  },
  {
    name: "Samsung",
    models: [
      ...models(
        [20, 21, 22, 23, 24, 25].flatMap((n) => [
          `Galaxy S${n}`,
          `Galaxy S${n}+`,
          `Galaxy S${n} Ultra`,
        ]),
        "samsung",
        ["uk"],
      ),
      ...models(["Galaxy Note20", "Galaxy Note20 Ultra"], "samsungAU", ["au"]),
      ...models(
        [2, 3, 4, 5, 6, 7]
          .map((n) => `Galaxy Z Fold${n}`)
          .concat([3, 4, 5, 6, 7].map((n) => `Galaxy Z Flip${n}`)),
        "samsung",
        ["uk"],
      ),
      ...models(
        [
          "Galaxy A56 5G",
          "Galaxy A55 5G",
          "Galaxy A54 5G",
          "Galaxy A36 5G",
          "Galaxy A35 5G",
        ],
        "samsung",
        ["uk"],
      ),
      ...models(["Galaxy A74 5G"]),
    ],
  },
  {
    name: "Google Pixel",
    models: models(
      [
        "Pixel 3",
        "Pixel 3a",
        "Pixel 4",
        "Pixel 4a",
        "Pixel 5",
        "Pixel 5a",
        "Pixel 6",
        "Pixel 6a",
        "Pixel 6 Pro",
        "Pixel 7",
        "Pixel 7a",
        "Pixel 7 Pro",
        "Pixel 8",
        "Pixel 8a",
        "Pixel 8 Pro",
        "Pixel 9",
        "Pixel 9a",
        "Pixel 9 Pro",
        "Pixel 9 Pro XL",
        "Pixel 10",
        "Pixel 10a",
        "Pixel 10 Pro",
        "Pixel 10 Pro XL",
        "Pixel Fold",
        "Pixel 9 Pro Fold",
        "Pixel 10 Pro Fold",
      ],
      "google",
    ),
  },
  {
    name: "Apple · iPad",
    models: models([
      "iPad Pro 11 (2020) · Wi-Fi + Cellular",
      "iPad Pro 12.9 (2020) · Wi-Fi + Cellular",
      "iPad Air (2019) · Wi-Fi + Cellular",
      "iPad (2019) · Wi-Fi + Cellular",
      "iPad mini (2019) · Wi-Fi + Cellular",
      "iPad (10th generation, 2022) · Wi-Fi + Cellular",
    ]),
  },
  {
    name: "OPPO",
    models: [
      ...models([
        "Find X3 Pro",
        "Find X5 Pro",
        "Find X6 Pro",
        "Find N2 Flip",
        "Find N3",
        "Find N3 Flip",
        "Find N5",
        "Reno13 Pro",
        "Reno14 Pro",
        "Find X9 Pro Satellite (PLG120)",
      ]),
      ...models(["Find X8 Pro (CPH2659)"], "oppo", ["es"]),
    ],
  },
  {
    name: "Xiaomi / Redmi",
    models: [
      ...models([
        "Xiaomi 14 Ultra",
        "Xiaomi 14 Pro",
        "Xiaomi 14",
        "Xiaomi 13 Ultra",
        "Xiaomi 13 Pro",
        "Xiaomi 13",
        "MIX Fold 2",
        "MIX Fold 3",
        "Xiaomi 12S Ultra",
        "Xiaomi 12 Pro",
        "Xiaomi 12",
        "Xiaomi 13T Pro",
        "Xiaomi 13T",
        "Xiaomi 12T Pro",
        "Redmi Note 14 Pro+ 5G",
        "Redmi Note 14 Pro 5G",
        "Redmi K70 Pro",
        "Redmi K70",
      ]),
      ...models(
        ["Xiaomi 14T", "Xiaomi 14T Pro", "Xiaomi 15", "Xiaomi 15 Ultra"],
        "xiaomi",
        ["uk", "es"],
      ),
      ...models(["Redmi Note 13 Pro 5G"], "redmi", ["my"]),
    ],
  },
  {
    name: "vivo",
    models: models([
      "X200 Pro",
      "X200",
      "X200s",
      "X200 FE",
      "X100 Pro",
      "X90 Pro",
      "V29",
      "V29 Lite 5G",
      "V40",
      "V40 Lite",
      "V50",
    ]),
  },
  {
    name: "OnePlus",
    models: [
      ...models(["OnePlus Open", "OnePlus 11", "OnePlus 12", "OnePlus 13"]),
      ...models(["OnePlus 13R"], "oneplus", ["us"]),
    ],
  },
  {
    name: "HONOR",
    models: models([
      "Magic V3",
      "200 Pro",
      "Magic6 Pro",
      "Magic V2",
      "HONOR 90",
      "Magic5 Pro",
      "HONOR X8",
      "Magic4 Pro",
      "400 Lite",
    ]),
  },
  {
    name: "Huawei",
    models: models([
      "P40",
      "P40 Pro",
      "P40 Pro+",
      "P50 Pro",
      "Mate40 Pro",
      "Mate X5",
      "Mate80 RS Ultimate Design",
      "Mate80 Pro",
      "Mate80 Pro+",
      "Mate80 Ultra",
      "Pura X",
    ]),
  },
  {
    name: "Sony",
    models: models([
      "Xperia 10 III Lite",
      "Xperia 1 IV",
      "Xperia 1 V",
      "Xperia 5 (exact model required)",
    ]),
  },
  {
    name: "Motorola",
    models: models(["razr 40 ultra", "razr 40", "Edge (exact model required)"]),
  },
  {
    name: "Sharp",
    models: models([
      "AQUOS sense4 lite",
      "AQUOS sense6s",
      "AQUOS sense7",
      "AQUOS sense7 plus",
      "AQUOS wish",
      "AQUOS wish2 SHG08",
      "AQUOS wish3",
      "AQUOS zero6",
      "Simple Sumaho6",
      "AQUOS R7",
      "AQUOS R8",
      "AQUOS R8 Pro",
      "AQUOS sense8",
    ]),
  },
  {
    name: "Rakuten",
    models: models([
      "Rakuten Mini",
      "Rakuten Big-S",
      "Rakuten Big",
      "Rakuten Hand",
      "Rakuten Hand 5G",
    ]),
  },
  {
    name: "TCL",
    models: models([
      "TCL 60",
      "TCL 60 XE NXTPAPER",
      "TCL 50 5G",
      "TCL 50 NXTPAPER",
      "TCL 50 Pro NXTPAPER",
      "TCL 40 XL",
    ]),
  },
  { name: "Fairphone", models: models(["Fairphone 4", "Fairphone 5"]) },
  {
    name: "ASUS",
    models: models(["ROG Phone 9", "ROG Phone 9 Pro", "Zenfone 12 Ultra"]),
  },
  { name: "Nokia", models: models(["XR21", "X30", "G60 5G"]) },
  { name: "realme", models: models(["14 Pro+", "GT 7"]) },
  {
    name: "Other brands",
    models: models([
      "Gemini PDA",
      "DOOGEE V30",
      "HAMMER Blade 3",
      "HAMMER Explorer PRO",
      "HAMMER Blade 5G",
      "myPhone NOW eSIM",
      "OUKITEL WP30 Pro",
      "OUKITEL WP33 Pro",
      "Nuu X5",
      "ZTE nubia Flip",
    ]),
  },
];
// Model-specific research additions; unreviewed supplier entries remain candidates.
for (const brand of deviceBrands) {
  for (const model of brand.models) {
    if (brand.name.endsWith("iPad")) {
      model.source = "ipad";
      model.regions = ["uk", "es", "au", "us", "jp", "my", "tw", "hk"];
    }
    if (brand.name === "OnePlus" && model.name === "OnePlus 13") {
      model.source = "oneplus13";
      model.regions = ["us"];
    }
    if (brand.name === "HONOR" && model.name === "Magic6 Pro") {
      model.source = "honor";
      model.regions = ["uk"];
    }
    if (brand.name === "Sony" && model.name === "Xperia 1 V") {
      model.source = "sony";
      model.regions = ["uk"];
    }
  }
}
export type Answer = "yes" | "no" | "unknown";
export type Assessment = "ready" | "review" | "locked" | "excluded";
export function assessDevice(
  brand: string,
  model: Device | undefined,
  region: string,
  unlocked: Answer,
  esim: Answer,
): Assessment {
  if (unlocked === "no") return "locked";
  if (
    brand === "Google Pixel" &&
    ((model?.name === "Pixel 3" && ["au", "jp", "tw"].includes(region)) ||
      (model?.name === "Pixel 3a" && region === "jp"))
  )
    return "excluded";
  if (
    !model?.source ||
    model.source === "oneplus" ||
    unlocked !== "yes" ||
    esim !== "yes" ||
    !region ||
    region === "unknown"
  )
    return "review";
  if (model.source === "apple" && ["cn", "hk"].includes(region))
    return "review";
  if (["Pixel 3", "Pixel 3a"].includes(model.name)) return "review";
  if (model.regions && !model.regions.includes(region)) return "review";
  return "ready";
}
