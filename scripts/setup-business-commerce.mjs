import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const folder = "private-data/business-portal/commerce-setup",
  mode = process.argv[2] ?? "--preflight";
mkdirSync(folder, { recursive: true });
function query(sql, name) {
  const file = `${folder}/${name}.sql`;
  writeFileSync(file, sql);
  if (!process.env.SUPABASE_CLI_PATH) throw Error("missing_cli");
  const r = spawnSync(
    process.env.SUPABASE_CLI_PATH,
    ["db", "query", "--linked", "--file", file],
    { encoding: "utf8", windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
  );
  if (r.status !== 0) {
    writeFileSync(
      `${folder}/last-error.log`,
      `${r.stderr ?? ""}\n${r.stdout ?? ""}`,
    );
    throw Error("query_failed");
  }
  const result = JSON.parse(r.stdout);
  if (!Array.isArray(result.rows)) throw Error("invalid_result");
  return result.rows;
}
const inner = (s) => s.replace(/^\s*(begin|commit|rollback);\s*$/gim, "");
try {
  if (
    !["--check", "--preflight", "--apply"].includes(mode) ||
    readFileSync("supabase/.temp/project-ref", "utf8").trim() !==
      "xfdwqalkkjclburzcwlv"
  )
    throw Error("invalid_target");
  const state = query(
    "select to_regprocedure('public.b2b_commerce_admin(uuid,text,jsonb)') is not null as commerce,to_regprocedure('public.b2b_notification_enqueue(uuid,uuid)') is not null as notifications,to_regprocedure('public.run_b2b_commercial_job()') is not null as scheduler;",
    "state",
  )[0];
  if (mode === "--check") {
    console.log(
      `B2B commerce: ${state.commerce ? "installed" : "pending"}; notification queue: ${state.notifications ? "installed" : "pending"}.`,
    );
  } else {
    let migration = state.commerce
      ? ""
      : inner(
          readFileSync(
            "supabase/migrations/20261105000300_business_commerce.sql",
            "utf8",
          ),
        );
    if (!state.notifications) {
      try {
        migration +=
          "\n" +
          inner(
            readFileSync(
              "supabase/migrations/20261105000400_business_notifications.sql",
              "utf8",
            ),
          );
      } catch {
        if (mode === "--apply") throw Error("notification_migration_pending");
      }
    }
    if (!state.scheduler)
      migration +=
        "\n" +
        inner(
          readFileSync(
            "supabase/migrations/20261105000500_business_scheduler.sql",
            "utf8",
          ),
        );
    const tests = inner(readFileSync("tests/business-commerce-db.sql", "utf8"));
    query(
      `begin;set local lock_timeout='5s';set local statement_timeout='60s';create temporary table retail_invariant as select count(*) as n from public.checkout_orders;${migration}\nsavepoint fixtures;${tests}\nrollback to fixtures;do $$begin if(select n from retail_invariant)<>(select count(*) from public.checkout_orders) then raise exception 'retail_changed';end if;end;$$;select true as verified;${mode === "--apply" ? "commit" : "rollback"};`,
      mode.slice(2),
    );
    console.log(
      mode === "--apply"
        ? "Additive B2B commerce installed. Fixtures rolled back; retail orders unchanged."
        : "B2B commerce security and lifecycle checks passed; entire transaction rolled back.",
    );
  }
} catch {
  console.error(
    "B2B setup stopped. Private diagnostic saved; no credentials or customer data printed.",
  );
  process.exitCode = 1;
}
