import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const mode = process.argv[2] ?? "--check",
  folder = "private-data/business-portal/setup";
mkdirSync(folder, { recursive: true });
function query(sql, name) {
  const file = `${folder}/${name}.sql`;
  writeFileSync(file, sql);
  const binary = process.env.SUPABASE_CLI_PATH;
  if (!binary) throw Error("missing_cli");
  const result = spawnSync(
    binary,
    ["db", "query", "--linked", "--file", file],
    { encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024 },
  );
  if (result.status !== 0) {
    writeFileSync(
      `${folder}/last-error.log`,
      `${result.stderr ?? ""}\n${result.stdout ?? ""}`,
    );
    throw Error("database_check_failed");
  }
  const data = JSON.parse(result.stdout);
  if (!Array.isArray(data.rows)) throw Error("invalid_result");
  return data.rows;
}
try {
  if (
    readFileSync("supabase/.temp/project-ref", "utf8").trim() !==
      "xfdwqalkkjclburzcwlv" ||
    !["--check", "--preflight", "--apply", "--test"].includes(mode)
  )
    throw Error("invalid_target");
  const state = query(
    "select to_regprocedure('public.b2b_workspace(uuid)') is not null as installed,to_regprocedure('public.b2b_admin_company_create(uuid,uuid,text,text)') is not null as admin_only;",
    "state",
  )[0];
  const installed = state.installed;
  if (mode === "--check") {
    console.log(
      installed && state.admin_only
        ? "Administrator-only business schema installed."
        : "Business schema update pending.",
    );
  } else if (mode === "--apply" && installed && state.admin_only) {
    console.log("Already installed; no changes made.");
  } else {
    let migration = installed
      ? ""
      : readFileSync(
          "supabase/migrations/20261105000100_business_portal.sql",
          "utf8",
        ).replace(/^\s*(begin|commit);\s*$/gim, "");
    if (!state.admin_only)
      migration +=
        "\n" +
        readFileSync(
          "supabase/migrations/20261105000200_business_admin_only.sql",
          "utf8",
        ).replace(/^\s*(begin|commit);\s*$/gim, "");
    const tests = readFileSync("tests/business-admin-only-db.sql", "utf8");
    query(
      `begin;set local lock_timeout='5s';set local statement_timeout='45s';create temporary table b2b_retail_invariant as select count(*) as n from public.checkout_orders;${migration}\nsavepoint fixtures;${tests}\nrollback to fixtures;do $$begin if(select n from b2b_retail_invariant)<>(select count(*) from public.checkout_orders) then raise exception 'retail_order_changed';end if;if has_function_privilege('anon','public.b2b_workspace(uuid)','execute') or has_function_privilege('authenticated','public.b2b_admin_action(uuid,text,jsonb)','execute') or has_table_privilege('authenticated','public.b2b_audit_logs','UPDATE') then raise exception 'privilege_invariant';end if;end;$$;select true as verified;${mode === "--apply" ? "commit" : "rollback"};`,
      mode.slice(2),
    );
    console.log(
      mode === "--apply"
        ? "Additive business schema applied; synthetic fixtures rolled back; retail orders unchanged."
        : "Business security checks passed; entire transaction rolled back.",
    );
  }
} catch {
  console.error(
    "Business setup stopped. Diagnostic remains private; no credentials or customer data printed.",
  );
  process.exitCode = 1;
}
