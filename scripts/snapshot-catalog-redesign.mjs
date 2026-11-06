import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  catalogConfig,
  createCatalogAPI,
} from "../src/lib/supabase/catalog-api.ts";
import { parsePlanRow } from "../src/lib/supabase/catalog-schema.ts";
import {
  createEsimAccessAPI,
  esimAccessConfig,
} from "../src/lib/integrations/esimaccess-api.ts";
process.loadEnvFile(".env.local");
try {
  const cfg = catalogConfig(process.env);
  if (!cfg) throw Error();
  const api = createCatalogAPI(cfg),
    db = createClient(cfg.url, cfg.key, { auth: { persistSession: false } });
  const [destinations, merchandising] = await Promise.all([
    api.destinations(),
    api.merchandising(),
  ]);
  const plans = [];
  for (let from = 0; from < 20000; from += 500) {
    const r = await db
      .from("catalog_plans")
      .select(
        "id,name,allowance,data_gb,days,kind,coverage_code,details,retail_price_cents,destination_slug",
      )
      .eq("is_published", true)
      .eq("kind", "fixed")
      .order("id")
      .range(from, from + 499);
    if (r.error) throw Error();
    plans.push(
      ...r.data.map((row) => ({
        ...parsePlanRow(row),
        destinationSlug: row.destination_slug,
      })),
    );
    if (r.data.length < 500) break;
  }
  const providerCfg = esimAccessConfig(process.env);
  if (!providerCfg) throw Error();
  const provider = await createEsimAccessAPI(providerCfg).privateCostPackages();
  mkdirSync("private-data/catalog-redesign", { recursive: true });
  writeFileSync(
    "private-data/catalog-redesign/snapshot.json",
    JSON.stringify({
      observedAt: new Date().toISOString(),
      destinations,
      merchandising,
      plans,
      provider,
    }),
  );
  console.log(
    `Read-only snapshot saved privately: ${destinations.length} destinations, ${plans.length} published fixed plans, ${provider.length} provider packages. No catalog or price changes.`,
  );
} catch {
  console.error(
    "Catalog snapshot failed; no credentials or supplier data printed.",
  );
  process.exitCode = 1;
}
