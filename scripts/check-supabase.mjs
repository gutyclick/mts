import { loadEnvFile } from "node:process";
import { existsSync } from "node:fs";
import {
  catalogConfig,
  createCatalogAPI,
} from "../src/lib/supabase/catalog-api.ts";

if (existsSync(".env.local")) loadEnvFile(".env.local");
try {
  const config = catalogConfig(process.env);
  if (!config)
    throw new Error(
      "Configure SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env.local first.",
    );
  const api = createCatalogAPI(config);
  const destinations = await api.destinations();
  let count = 0;
  for (const destination of destinations) {
    const plans = await api.plans(destination.slug);
    if (plans.length !== destination.planCount)
      throw new Error(
        "Published destination counts do not match published plans.",
      );
    count += plans.length;
  }
  if (!destinations.length)
    throw new Error(
      "The connected catalog is empty. Apply migrations and seed first.",
    );
  console.log(
    `Connected catalog verified: ${destinations.length} destinations, ${count} fixed plans. No credentials printed.`,
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Supabase verification failed.",
  );
  process.exitCode = 1;
}
