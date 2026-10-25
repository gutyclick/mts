import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { destinations } from "../src/lib/catalog.ts";
import { planSchema } from "../src/lib/supabase/catalog-schema.ts";

const plans = JSON.parse(
  readFileSync(new URL("../src/data/plans.json", import.meta.url), "utf8"),
);
const details = JSON.parse(
  readFileSync(
    new URL("../src/data/plan-details.json", import.meta.url),
    "utf8",
  ),
);
const quote = (value) =>
  value == null ? "null" : `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${quote(JSON.stringify(value))}::jsonb`;
const lines = [
  "-- Generated from the allowlisted catalog. No prices. Existing rows are preserved.",
  "begin;",
];
let count = 0;
for (const destination of destinations) {
  const { slug, name, code, type, aliases, image, artworkKind } = destination;
  lines.push(
    `insert into public.catalog_destinations (slug,name,code,type,aliases,image,artwork_kind,is_published) values (${quote(slug)},${json(name)},${quote(code)},${quote(type)},array[${aliases.map(quote).join(",")}]::text[],${quote(image)},${quote(artworkKind)},true) on conflict (slug) do nothing;`,
  );
  for (const raw of plans[slug] ?? []) {
    const plan = planSchema.parse({ ...raw, details: details[raw.id] });
    lines.push(
      `insert into public.catalog_plans (id,destination_slug,name,allowance,data_gb,days,kind,coverage_code,details,is_published) values (${quote(plan.id)},${quote(slug)},${quote(plan.name)},${quote(plan.allowance)},${plan.dataGb},${plan.days},'fixed',${quote(plan.coverageCode)},${plan.details ? json(plan.details) : "null"},true) on conflict (id) do nothing;`,
    );
    count++;
  }
}
lines.push("commit;", "");
const target = resolve("supabase/seed.sql");
writeFileSync(target, lines.join("\n"));
console.log(
  `Generated ${destinations.length} destinations and ${count} fixed plans. No prices. Existing rows will not be overwritten.`,
);
