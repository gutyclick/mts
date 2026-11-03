import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const mode = process.argv[2] ?? "--check";
const folder = "private-data/catalog-curation/setup";
mkdirSync(folder, { recursive: true });
function query(sql, name) {
  const path = `${folder}/${name}.sql`;
  writeFileSync(path, sql);
  const binary = process.env.SUPABASE_CLI_PATH;
  if (!binary) throw Error("set_SUPABASE_CLI_PATH");
  const r = spawnSync(binary, ["db", "query", "--linked", "--file", path], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
  if (r.status !== 0) throw Error("database_verification_failed");
  const result = JSON.parse(r.stdout);
  if (!Array.isArray(result.rows)) throw Error("invalid_result");
  return result.rows;
}
try {
  if (
    readFileSync("supabase/.temp/project-ref", "utf8").trim() !==
    "xfdwqalkkjclburzcwlv"
  )
    throw Error("wrong_project");
  if (!["--check", "--preflight", "--apply"].includes(mode))
    throw Error("invalid_mode");
  const state = query(
    "select to_regclass('public.catalog_plan_merchandising') is not null as base, to_regprocedure('public.catalog_original_simcoins_prepare_payment(uuid,text,uuid,integer)') is not null as guarded;",
    "state",
  )[0];
  if (mode === "--check") {
    console.log(
      state.base && state.guarded
        ? "Catalog curation installed."
        : "Catalog curation migration pending.",
    );
  } else if (state.base && state.guarded) {
    console.log("Catalog curation already installed. No changes made.");
  } else {
    const sql = [
      !state.base && "20261103000400_catalog_merchandising.sql",
      !state.guarded && "20261103000500_catalog_simcoins_guard.sql",
    ]
      .filter(Boolean)
      .map((name) =>
        readFileSync(`supabase/migrations/${name}`, "utf8").replace(
          /^\s*(begin|commit);\s*$/gim,
          "",
        ),
      )
      .join("\n");
    const verification = `
  create temporary table catalog_price_invariant as select id,retail_price_cents from public.catalog_plans;
  ${sql}
  do $$begin
  if exists((select id,retail_price_cents from public.catalog_plans except select * from catalog_price_invariant) union all (select * from catalog_price_invariant except select id,retail_price_cents from public.catalog_plans)) then raise exception 'price_or_sku_changed';end if;
  if has_function_privilege('anon','public.catalog_merchandising_save(uuid,text,jsonb)','execute') or has_column_privilege('anon','public.catalog_plan_merchandising','updated_by','select') or has_table_privilege('anon','public.catalog_destination_merchandising','select') then raise exception 'privacy_invariant';end if;
  end;$$;
  select true as verified;`;
    query(
      `begin;set local lock_timeout='5s';set local statement_timeout='30s';${verification}${mode === "--preflight" ? "rollback" : "commit"};`,
      mode.slice(2),
    );
    console.log(
      mode === "--preflight"
        ? "Actual schema verified; transaction rolled back. No SKU or price changed."
        : "Additive curation migration applied; all original SKUs and prices verified unchanged.",
    );
  }
} catch {
  console.error(
    "Catalog setup stopped; no credentials or private responses printed.",
  );
  process.exitCode = 1;
}
