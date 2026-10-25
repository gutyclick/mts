import { loadEnvFile } from "node:process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { spawnSync } from "node:child_process";
import {
  createEsimAccessAPI,
  esimAccessConfig,
  EsimAccessError,
} from "../src/lib/integrations/esimaccess-api.ts";
import { compareProviderCatalog } from "../src/lib/integrations/esimaccess-catalog.ts";
import { catalogConfig } from "../src/lib/supabase/catalog-api.ts";

if (existsSync(".env.local")) loadEnvFile(".env.local");
let stage = "catalog verification";
try {
  const providerConfig = esimAccessConfig(process.env);
  const databaseConfig = catalogConfig(process.env);
  if (!providerConfig || !databaseConfig)
    throw new EsimAccessError("configuration");
  const packages =
    await createEsimAccessAPI(providerConfig).listFixedPackages();
  const client = createClient(databaseConfig.url, databaseConfig.key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const schema = z.array(
    z.object({
      id: z.string(),
      allowance: z.string(),
      days: z.number().int().positive(),
      coverage_code: z.string(),
    }),
  );
  const local = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await client
      .from("catalog_plans")
      .select("id,allowance,days,coverage_code")
      .eq("is_published", true)
      .order("id")
      .range(offset, offset + 999);
    if (error) throw new Error("Catalog lookup failed");
    const rows = schema.parse(data);
    local.push(
      ...rows.map((row) => ({
        id: row.id,
        allowance: row.allowance,
        days: row.days,
        coverageCode: row.coverage_code,
      })),
    );
    if (rows.length < 1000) break;
  }
  if (!local.length) throw new Error("Empty published catalog");
  const report = compareProviderCatalog(local, packages);
  if (process.argv.includes("--sync")) {
    stage = "binding identity";
    if (
      new Set(report.matches.map((p) => p.planId)).size !==
        report.matches.length ||
      new Set(report.matches.map((p) => p.packageCode)).size !==
        report.matches.length
    )
      throw new Error("Duplicate bindings");
    if (report.conflicts.length || !report.matches.length)
      throw new Error("Identity conflicts block synchronization");
    const projectRef = new URL(databaseConfig.url).hostname.split(".")[0];
    if (!/^[a-z]{20}$/.test(projectRef))
      throw new Error("Invalid project identity");
    stage = "worker authentication";
    const result = spawnSync(
      process.env.ComSpec || "cmd.exe",
      [
        "/d",
        "/s",
        "/c",
        `npx.cmd --yes supabase projects api-keys --project-ref ${projectRef} --reveal --output json`,
      ],
      { encoding: "utf8", maxBuffer: 1024 * 1024 },
    );
    if (result.status !== 0)
      throw new Error("Authenticated Supabase CLI required");
    const secret = JSON.parse(result.stdout).find(
      (key) => key.type === "secret" && key.api_key.startsWith("sb_secret_"),
    )?.api_key;
    if (!secret) throw new Error("Could not obtain worker credentials");
    const admin = createClient(databaseConfig.url, secret, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    stage = "private binding sync";
    const { error } = await admin.rpc("sync_esim_access_bindings", {
      bindings: report.matches.map((binding) => ({
        plan_id: binding.planId,
        provider_slug: binding.providerSlug,
        package_code: binding.packageCode,
        volume_bytes: binding.volumeBytes,
        days: binding.days,
      })),
    });
    if (error) {
      const safeCode =
        typeof error.code === "string" && /^[A-Z0-9]{1,12}$/.test(error.code)
          ? error.code
          : "unknown";
      throw new EsimAccessError("response", safeCode);
    }
    console.log(
      "Identificadores del proveedor sincronizados en una tabla privada. El catálogo público no se ha modificado.",
    );
  }
  mkdirSync(".supabase", { recursive: true });
  writeFileSync(
    ".supabase/esimaccess-catalog-report.json",
    JSON.stringify({ checkedAt: new Date().toISOString(), ...report }, null, 2),
  );
  console.log(
    JSON.stringify({
      connected: true,
      fixedProviderPlans: packages.length,
      publishedPlans: local.length,
      matchedPlans: report.matches.length,
      unavailablePlans: report.missing.length,
      identityConflicts: report.conflicts.length,
      newProviderPlans: report.unlisted.length,
      pricesStored: false,
      purchasesMade: false,
    }),
  );
  if (report.conflicts.length) process.exitCode = 1;
} catch (error) {
  console.error(
    error instanceof EsimAccessError
      ? error.message
      : `No se pudo completar ${stage}. No se mostraron credenciales ni respuestas privadas.`,
  );
  process.exitCode = 1;
}
