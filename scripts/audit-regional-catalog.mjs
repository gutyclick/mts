import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
const snapshot = read(
  process.argv[2] || "private-data/catalog-redesign/snapshot.json",
);
const policy = read("src/data/regional-catalog-policy.json");
const available = new Set(snapshot.merchandising.availableIds);
const hidden = new Set(
  snapshot.merchandising.overrides
    .filter((o) => o.visibility === "hide" || o.incident_block)
    .map((o) => o.plan_id),
);
// Match the current provider's exact raw slug, duration AND bytes. Published stale SKUs are excluded.
const plans = snapshot.plans.filter(
  (p) =>
    available.has(p.id) &&
    !hidden.has(p.id) &&
    snapshot.provider.some(
      (q) =>
        q.slug === p.id &&
        q.days === p.days &&
        q.volumeBytes === p.dataGb * 1024 ** 3,
    ),
);
const money = (n) => `$${(n / 100).toFixed(2)}`;
const quote = (value) => `"${String(value).replaceAll('"', '""')}"`;
const rows = [
  [
    "group",
    "chosen",
    "slug",
    "coverage_count",
    "gb_options",
    "durations",
    "price_examples_usd",
    "reason",
  ],
];
let md = `# Regional catalog review\n\nLocal discovery proposal only. Snapshot: ${snapshot.observedAt}. No provider, database, price, URL or SKU mutations. Coverage is counted from the exact current provider binding, not the marketing name. Only commercially available, non-hidden, published SKUs matching provider slug + days + bytes are counted. Prices are registered retail USD. Private wholesale amounts are deliberately excluded.\n\nOne main discovery catalog per selected geographic family; source URLs and SKU IDs remain unchanged. Route bundles and unselected subregions are hidden from local discovery. A narrower chosen catalog does not inherit any suppressed catalog's coverage. Europe selects EU-33 for core destinations including France; Asia selects AS-14 for affordability.\n\n`;
for (const group of policy.groups) {
  md += `## ${group.displayName.en}\n\n${group.reason}\n\n| Catalog | Actual areas | GB options | Days | Exact GB/day price baskets (USD) |\n|---|---|---|---|---|\n`;
  let availabilityNote = "";
  for (const slug of group.canonicalSlugs) {
    const ps = plans.filter((p) => p.destinationSlug === slug);
    const coverage = [
      ...new Set(
        ps.flatMap(
          (p) =>
            snapshot.provider.find(
              (q) =>
                q.slug === p.id &&
                q.days === p.days &&
                q.volumeBytes === p.dataGb * 1024 ** 3,
            ).coverage,
        ),
      ),
    ];
    const gb = [...new Set(ps.map((p) => p.dataGb))].sort((a, b) => a - b);
    const days = [...new Set(ps.map((p) => p.days))].sort((a, b) => a - b);
    const prices = ps
      .map((p) => `${p.dataGb}GB/${p.days}d ${money(p.retailPriceCents)}`)
      .join("; ");
    const chosen = slug === group.sourceSlug;
    rows.push([
      group.group,
      chosen ? "yes" : "no",
      slug,
      coverage.length,
      gb.join(";"),
      days.join(";"),
      prices,
      group.reason,
    ]);
    md += `| ${chosen ? "**Selected** " : ""}${slug} | ${coverage.length} | ${gb.join(", ") || "none"} | ${days.join(", ") || "none"} | ${prices || "No current visible matching plans"} |\n`;
    if (chosen) {
      const missing = gb.filter(
        (g) => !ps.some((p) => p.dataGb === g && p.days === 15),
      );
      availabilityNote = `\n15-day availability: ${
        ps
          .filter((p) => p.days === 15)
          .map((p) => `${p.dataGb}GB`)
          .join(", ") || "none"
      }. Missing 15-day capacities: ${missing.map((g) => `${g}GB`).join(", ") || "none"}. These combinations must remain unavailable; never synthesize a plan or price.\n\n`;
    }
  }
  md += availabilityNote + "\n";
}
md +=
  "## Review limits\n\nCoverage counts compare area codes, not a promise of equivalent countries, networks, activation or service quality. Different coverage or duration prevents a blanket cheapest claim. The CSV retains every exact available GB/day retail basket so reviewers can compare matching combinations. Old direct URLs continue to open their original catalog; discovery suppression is not a redirect. No wholesale costs, provider package codes or credentials are published.\n";
fs.mkdirSync(path.join(root, "reports"), { recursive: true });
fs.writeFileSync(
  path.join(root, "reports/catalog-regional-review.csv"),
  rows.map((r) => r.map(quote).join(",")).join("\n") + "\n",
);
fs.writeFileSync(path.join(root, "docs/catalog-regional-review.md"), md);
console.log(
  `Wrote commercial-only review for ${policy.groups.length} groups, ${rows.length - 1} catalogs.`,
);
