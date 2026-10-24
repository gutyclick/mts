import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";

const source = process.argv[2];
if (!source)
  throw new Error("Usage: npm run import:catalog -- <path-to-provider-csv>");
const rows = parse(await readFile(source, "utf8"), {
  columns: true,
  skip_empty_lines: true,
  bom: true,
});
const normalize = (value) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
const slugify = (value) =>
  normalize(value)
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
const names = new Map();
for (const row of rows) {
  if (
    !["Single Country", "Regional"].includes(row.Type) ||
    !row.Code ||
    !row.Slug
  )
    throw new Error("Invalid catalog row identity");
  const key = `${row.Type}:${row.Code}`;
  if (!names.has(key)) names.set(key, new Map());
  const variants = names.get(key);
  variants.set(row.Location, (variants.get(row.Location) ?? 0) + 1);
}
const canonical = new Map(
  [...names].map(([code, variants]) => [
    code,
    [...variants].sort(
      (a, b) => b[1] - a[1] || b[0].length - a[0].length,
    )[0][0],
  ]),
);
const display = new Intl.DisplayNames(["es"], { type: "region" });
const regionWords = {
  "South East Asia": "Sudeste Asiático",
  "South Asia": "Asia del Sur",
  "Central Asia": "Asia Central",
  "North America": "América del Norte",
  "South America": "América del Sur",
  "Middle East": "Oriente Medio",
  "North Africa": "Norte de África",
  "New Zealand": "Nueva Zelanda",
  "South Korea": "Corea del Sur",
  Singapore: "Singapur",
  Malaysia: "Malasia",
  Thailand: "Tailandia",
  Ireland: "Irlanda",
  Slovenia: "Eslovenia",
  Japan: "Japón",
  Caribbean: "Caribe",
  Balkans: "Balcanes",
  Europe: "Europa",
  Africa: "África",
  China: "China",
  Morocco: "Marruecos",
  Oceania: "Oceanía",
  USA: "Estados Unidos",
  UK: "Reino Unido",
  countries: "países",
  areas: "zonas",
  mainland: "continental",
};
function spanishRegion(name) {
  for (const [en, es] of Object.entries(regionWords))
    name = name.replaceAll(en, es);
  return name.replaceAll("&", "y");
}
const aliases = {
  JP: ["japon", "tokio", "tokyo", "kyoto"],
  US: ["usa", "us", "eeuu", "ee. uu.", "america", "new york", "nueva york"],
  GB: [
    "uk",
    "great britain",
    "england",
    "inglaterra",
    "gran bretana",
    "london",
    "londres",
  ],
  TH: ["thai", "bangkok", "phuket"],
  AU: ["sydney", "sidney", "melbourne"],
};
const groups = new Map();
const ids = new Set();
for (const row of rows) {
  const country = row.Type === "Single Country";
  const name = canonical.get(`${row.Type}:${row.Code}`).trim();
  const key = country ? `country:${row.Code}` : `region:${normalize(name)}`;
  if (!groups.has(key))
    groups.set(key, {
      name,
      country,
      code: row.Code,
      aliases: new Set(),
      plans: [],
    });
  const group = groups.get(key);
  group.aliases.add(row.Location);
  if (ids.has(row.Slug)) throw new Error("Duplicate plan identifier");
  ids.add(row.Slug);
  const match = /^(\d+(?:\.\d+)?)(GB|MB)$/.exec(row.GBs);
  const days = Number(row.Days);
  if (
    !match ||
    !Number.isInteger(days) ||
    days <= 0 ||
    !["Full Speed", "Unlimited FUP"].includes(row.Plan)
  )
    throw new Error(`Invalid plan information: ${row.Slug}`);
  // Explicit allowlist: wholesale prices, rates, history, IP and unknown fields never leave this importer.
  group.plans.push({
    id: row.Slug,
    name: row["Plan Name"].trim().replace(/\s+/g, " "),
    allowance: row.GBs,
    dataGb: Number(match[1]) / (match[2] === "MB" ? 1000 : 1),
    days,
    kind: row.Plan === "Full Speed" ? "fixed" : "daily",
    coverageCode: row.Code,
  });
}
const destinations = [];
const plans = {};
const slugs = new Set();
for (const group of groups.values()) {
  const slug = slugify(group.name);
  if (slugs.has(slug)) throw new Error(`Conflicting destination slug: ${slug}`);
  slugs.add(slug);
  const es = group.country
    ? group.code === "BQ"
      ? "Bonaire"
      : display.of(group.code)
    : spanishRegion(group.name);
  destinations.push({
    slug,
    name: { en: group.name === "kosovo" ? "Kosovo" : group.name, es },
    code: group.code,
    type: group.country ? "country" : "region",
    aliases: [...new Set([...group.aliases, ...(aliases[group.code] ?? [])])],
    planCount: group.plans.length,
    dataMinGb: Math.min(...group.plans.map((plan) => plan.dataGb)),
    dataMaxGb: Math.max(...group.plans.map((plan) => plan.dataGb)),
  });
  plans[slug] = group.plans.sort(
    (a, b) =>
      a.kind.localeCompare(b.kind) ||
      a.dataGb - b.dataGb ||
      a.days - b.days ||
      a.id.localeCompare(b.id),
  );
}
destinations.sort((a, b) => a.name.en.localeCompare(b.name.en));
await mkdir("src/data", { recursive: true });
await writeFile(
  "src/data/destinations.json",
  JSON.stringify(destinations, null, 2) + "\n",
);
await writeFile("src/data/plans.json", JSON.stringify(plans, null, 2) + "\n");
const summary = {
  sourceRows: rows.length,
  importedPlans: ids.size,
  destinations: destinations.length,
  countries: destinations.filter((d) => d.type === "country").length,
  regions: destinations.filter((d) => d.type === "region").length,
  normalizedLocations: [...names.values()].filter(
    (variants) => variants.size > 1,
  ).length,
  excludedFields: [
    "Price",
    "$/GB",
    "History",
    "Size",
    "SMS",
    "Top",
    "Act",
    "IP",
  ],
};
await writeFile(
  "src/data/catalog-summary.json",
  JSON.stringify(summary, null, 2) + "\n",
);
await mkdir("public/flags", { recursive: true });
for (const destination of destinations.filter((d) => d.type === "country")) {
  await copyFile(
    `node_modules/circle-flags/flags/${destination.code.toLowerCase()}.svg`,
    `public/flags/${destination.code.toLowerCase()}.svg`,
  );
}
await copyFile(
  "node_modules/circle-flags/LICENSE.md",
  "public/flags/LICENSE.md",
);
console.log(JSON.stringify(summary, null, 2));
