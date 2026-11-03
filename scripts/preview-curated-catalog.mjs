// Read-only report. Never writes catalog records or price data.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { createHash } from "node:crypto";
import { curateCatalog } from "../src/lib/catalog-curation.ts";
import {
  catalogConfig,
  createCatalogAPI,
} from "../src/lib/supabase/catalog-api.ts";
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const local = process.argv.includes("--local");
const evidence = json("src/data/catalog-connectivity-evidence.json");
let destinations,
  plansFor,
  config = null;
if (local) {
  destinations = json("src/data/destinations.json");
  const catalog = json("src/data/plans.json"),
    details = json("src/data/plan-details.json"),
    prices = json("src/data/retail-prices.json");
  plansFor = async (d) =>
    (catalog[d.slug] ?? []).map((p) => ({
      ...p,
      details: details[p.id],
      retailPriceCents: prices[p.id],
    }));
} else {
  loadEnvFile(".env.local");
  const c = catalogConfig(process.env);
  if (!c) throw Error("catalog_configuration_required");
  const api = createCatalogAPI(c);
  destinations = await api.destinations();
  config = await api.merchandising();
  plansFor = (d) => api.plans(d.slug);
}
const available = config ? new Set(config.availableIds) : null;
const selected = [],
  decisions = [],
  priceRecords = [];
async function* batches() {
  for (let i = 0; i < destinations.length; i += 6) {
    const results = await Promise.all(
      destinations
        .slice(i, i + 6)
        .map(async (d) => ({ d, plans: await plansFor(d) })),
    );
    for (const result of results) yield result;
  }
}
for await (const { d, plans } of batches()) {
  priceRecords.push(...plans.map((p) => [p.id, p.retailPriceCents]));
  const settings = config?.destinations.find(
    (r) => r.destination_slug === d.slug,
  );
  const result = curateCatalog({
    plans: available ? plans.filter((p) => available.has(p.id)) : plans,
    destinationCode: d.code,
    destinationType: d.type,
    overrides: config?.overrides,
    approvedModes: settings?.approval_verified
      ? settings.approved_modalities
      : undefined,
    evidence,
  });
  decisions.push({ destination: d.slug, ...result });
  for (const mode of result.modes)
    for (const item of mode.plans)
      selected.push({
        destination: d.slug,
        mode: mode.id,
        section: "primary",
        category: item.category,
        plan_id: item.plan.id,
        exact_name: item.plan.name,
        data_gb: item.plan.dataGb,
        days: item.plan.days,
        retail_price_cents: item.plan.retailPriceCents,
        recommended: item.recommended,
        reason: item.reasons.join(";"),
      });
  for (const mode of result.modes)
    for (const plan of mode.secondaryPlans)
      selected.push({
        destination: d.slug,
        mode: mode.id,
        section: "long_stay",
        category: "",
        plan_id: plan.id,
        exact_name: plan.name,
        data_gb: plan.dataGb,
        days: plan.days,
        retail_price_cents: plan.retailPriceCents,
        recommended: false,
        reason: "secondary_long_stay",
      });
}
const directory = "private-data/catalog-curation";
mkdirSync(directory, { recursive: true });
const escape = (v) => '"' + String(v ?? "").replaceAll('"', '""') + '"';
const headers = [
  "destination",
  "mode",
  "section",
  "category",
  "plan_id",
  "exact_name",
  "data_gb",
  "days",
  "retail_price_cents",
  "recommended",
  "reason",
];
writeFileSync(
  `${directory}/curated-preview-${local ? "local" : "live"}.csv`,
  "\uFEFF" +
    [headers, ...selected.map((r) => headers.map((h) => r[h]))]
      .map((row) => row.map(escape).join(","))
      .join("\r\n"),
);
const summary = {
  source: local
    ? "local_snapshot_not_live_availability"
    : "current_published_catalog_and_provider_bindings",
  createdAt: new Date().toISOString(),
  destinations: destinations.length,
  selected: selected.filter((r) => r.section === "primary").length,
  secondary: selected.filter((r) => r.section === "long_stay").length,
  empty: decisions.filter((d) => !d.modes.length).map((d) => d.destination),
  retailPriceFingerprint: createHash("sha256")
    .update(
      JSON.stringify(priceRecords.sort((a, b) => a[0].localeCompare(b[0]))),
    )
    .digest("hex"),
  writesToCatalog: false,
};
writeFileSync(
  `${directory}/curated-audit-${local ? "local" : "live"}.json`,
  JSON.stringify({ summary, decisions }, null, 2),
);
console.log(JSON.stringify(summary, null, 2));
