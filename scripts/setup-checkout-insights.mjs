// Additive operator setup; never prints credentials, buyers or event rows.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const mode = process.argv[2] ?? "--check";
const folder = "private-data/checkout-insights-setup";
function query(sql, name) {
  mkdirSync(folder, { recursive: true });
  const path = `${folder}/${name}.sql`;
  writeFileSync(path, sql, { mode: 0o600 });
  const binary = process.env.SUPABASE_CLI_PATH;
  if (!binary) throw Error("set_SUPABASE_CLI_PATH");
  const r = spawnSync(binary, ["db", "query", "--linked", "--file", path], {
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 1024 * 1024,
  });
  if (r.status !== 0) throw Error("database_command_failed");
  const result = JSON.parse(r.stdout);
  if (!Array.isArray(result.rows)) throw Error("invalid_database_result");
  return result.rows;
}
const check = `select to_regclass('public.checkout_analytics_stages') is not null as installed,
to_regprocedure('public.admin_checkout_analytics(uuid,integer)') is not null as report;`;
try {
  if (
    readFileSync("supabase/.temp/project-ref", "utf8").trim() !==
    "xfdwqalkkjclburzcwlv"
  )
    throw Error("wrong_project");
  if (!["--check", "--preflight", "--apply"].includes(mode))
    throw Error("invalid_mode");
  const state = query(check, "state")[0];
  if (mode === "--check") {
    console.log(
      state?.installed && state?.report
        ? "Checkout measurement infrastructure installed."
        : "Checkout measurement migration pending.",
    );
  } else if (state?.installed && state?.report) {
    console.log("Checkout measurement already installed. No changes made.");
  } else {
    const sql = readFileSync(
      "supabase/migrations/20261103000200_checkout_funnel.sql",
      "utf8",
    ).replace(/^\s*(begin|commit);\s*$/gim, "");
    query(
      `begin;set local lock_timeout='5s';set local statement_timeout='30s';${sql}
do $$ begin if has_function_privilege('anon','public.analytics_record_checkout_stage(text,text)','execute') or has_function_privilege('authenticated','public.admin_checkout_analytics(uuid,integer)','execute') or has_table_privilege('anon','public.checkout_analytics_stages','select') then raise exception 'measurement_privacy_invariant';end if;end;$$;
select true as verified;${mode === "--preflight" ? "rollback" : "commit"};`,
      mode.slice(2),
    );
    console.log(
      mode === "--preflight"
        ? "Checkout measurement verified against actual schema and rolled back."
        : "Checkout measurement migration applied. No historical orders or prices changed.",
    );
  }
} catch (error) {
  console.error(
    "Checkout measurement setup stopped: " +
      (error instanceof Error ? error.message : "unknown") +
      ". No credentials printed.",
  );
  process.exitCode = 1;
}
