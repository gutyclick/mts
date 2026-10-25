import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { catalogConfig } from "../src/lib/supabase/catalog-api.ts";
import { parsePlanRow } from "../src/lib/supabase/catalog-schema.ts";
import {
  buildStripeCatalog,
  catalogCSV,
  syncStripeCatalog,
  testSecret,
} from "./lib/stripe-catalog.mjs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
try {
  const args = process.argv.slice(2);
  if (args.some((arg) => !["--apply"].includes(arg)))
    throw new Error("Unknown option");
  const apply = args.includes("--apply");
  // Validate the key before any mutation. No live mode option exists in this command.
  const key = apply ? testSecret(process.env.STRIPE_TEST_SECRET_KEY) : null;
  const readJSON = (path) => JSON.parse(readFileSync(path, "utf8"));
  const destinations = readJSON("src/data/destinations.json");
  const config = catalogConfig(process.env);
  let plans;
  if (config) {
    plans = {};
    const client = createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client
        .from("catalog_plans")
        .select(
          "id,name,allowance,data_gb,days,kind,coverage_code,retail_price_cents,destination_slug",
        )
        .eq("is_published", true)
        .order("id")
        .range(offset, offset + 999);
      if (error || !data) throw new Error("Published catalog unavailable");
      for (const row of data) {
        if (!destinations.some((d) => d.slug === row.destination_slug))
          throw new Error("Unknown destination");
        (plans[row.destination_slug] ??= []).push(parsePlanRow(row));
      }
      if (data.length < 1000) break;
      if (offset >= 100000) throw new Error("Catalog safety limit");
    }
  } else {
    const prices = readJSON("src/data/retail-prices.json");
    plans = Object.fromEntries(
      Object.entries(readJSON("src/data/plans.json")).map(([slug, rows]) => [
        slug,
        rows.map((p) => ({ ...p, retailPriceCents: prices[p.id] })),
      ]),
    );
  }
  const rows = buildStripeCatalog(destinations, plans);
  mkdirSync("private-data/stripe", { recursive: true });
  writeFileSync("private-data/stripe/catalog.csv", catalogCSV(rows));
  writeFileSync(
    "private-data/stripe/catalog.json",
    JSON.stringify(rows, null, 2) + "\n",
  );
  console.log(
    `${rows.length} fixed retail plans exported to private-data/stripe. Amounts are USD cents. Source: ${config ? "Supabase published catalog" : "bundled catalog"}.`,
  );
  if (apply) {
    const stripe = new Stripe(key, { maxNetworkRetries: 2, timeout: 20000 });
    const bindings = await syncStripeCatalog(stripe, rows, (done, total) => {
      console.log(`Test catalog: ${done}/${total} plans synchronized.`);
    });
    writeFileSync(
      "private-data/stripe/test-bindings.json",
      JSON.stringify(bindings, null, 2) + "\n",
    );
    console.log(
      `${bindings.length} test products/prices synchronized. No payments or eSIM orders created.`,
    );
  } else console.log("Preview only. No Stripe connection or writes performed.");
} catch {
  // SDK and database errors may contain request bodies or credentials. Never log raw errors.
  console.error(
    "Stripe catalog failed. Check the test key, catalog, network and Stripe permissions. No credentials were printed. A partial sync can be resumed with the same command.",
  );
  process.exitCode = 1;
}
