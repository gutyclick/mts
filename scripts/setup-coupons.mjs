// Operator-only additive migration. Never prints credentials, buyers or costs.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
const project = "xfdwqalkkjclburzcwlv";
const mode = process.argv[2] ?? "--check";
const folder = "private-data/coupon-setup";
function query(sql, name) {
  mkdirSync(folder, { recursive: true });
  const file = `${folder}/${name}.sql`;
  writeFileSync(file, sql, { mode: 0o600 });
  const binary = process.env.SUPABASE_CLI_PATH;
  const result = binary
    ? spawnSync(binary, ["db", "query", "--linked", "--file", file], {
        encoding: "utf8",
        windowsHide: true,
        maxBuffer: 8 * 1024 * 1024,
      })
    : spawnSync(
        process.platform === "win32"
          ? (process.env.ComSpec ?? "cmd.exe")
          : "npx",
        process.platform === "win32"
          ? [
              "/d",
              "/s",
              "/c",
              `npx.cmd supabase db query --linked --file ${file}`,
            ]
          : ["supabase", "db", "query", "--linked", "--file", file],
        { encoding: "utf8", windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      );
  if (result.status !== 0) throw Error("database_command_failed");
  const data = JSON.parse(result.stdout);
  if (!Array.isArray(data.rows)) throw Error("invalid_database_result");
  return data.rows;
}
const check = `select to_regclass('public.coupon_definitions') is not null as installed,
exists(select 1 from pg_trigger where tgname='coupon_audit_immutable' and not tgisinternal) as audit_immutable,
exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='coupon_prepare_payment' and position('coupon_live_mode_required' in pg_get_functiondef(p.oid))>0) as live_isolated,
not has_table_privilege('anon','public.checkout_orders','insert') as orders_private;`;
try {
  if (readFileSync("supabase/.temp/project-ref", "utf8").trim() !== project)
    throw Error("wrong_project");
  if (!["--check", "--preflight", "--apply"].includes(mode))
    throw Error("invalid_mode");
  if (mode !== "--check") {
    const state = query(check, "state")[0];
    const pending = [
      ...(!state.installed ? ["20261101000100_checkout_coupons"] : []),
      ...(!state.audit_immutable
        ? ["20261101000200_coupon_audit_immutable"]
        : []),
      ...(!state.live_isolated ? ["20261101000300_coupon_live_mode"] : []),
    ];
    if (!pending.length) {
      console.log("Coupon migrations already installed. No changes made.");
      process.exit(0);
    }
    const migration = pending
      .map((name) =>
        readFileSync(`supabase/migrations/${name}.sql`, "utf8").replace(
          /^\s*(begin|commit);\s*$/gim,
          "",
        ),
      )
      .join("\n");
    // A schema preflight can always be rolled back; no customer rows are changed.
    const tail = `do $$ begin if has_function_privilege('anon','public.coupon_create_quote(text,text,uuid,jsonb,text,uuid,text)','execute') or has_table_privilege('service_role','public.coupon_audit_logs','update') then raise exception 'coupon_privacy_invariant';end if;end;$$;
      select count(*)::int as offers, true as private_rpc from public.coupon_definitions;`;
    const rows = query(
      `begin;set local lock_timeout='5s';set local statement_timeout='30s';${migration}\n${tail}\n${mode === "--preflight" ? "rollback" : "commit"};`,
      mode.slice(2),
    );
    if ((!state.installed && rows[0]?.offers !== 0) || !rows[0]?.private_rpc)
      throw Error("migration_invariants_failed");
    console.log(
      mode === "--preflight"
        ? "Coupon migration verified against actual schema and rolled back."
        : "Coupon migration applied. No coupons activated or historical orders modified.",
    );
  } else {
    const state = query(check, "check")[0];
    if (!state?.orders_private) throw Error("order_privacy_invariant_failed");
    console.log(
      state.installed && state.audit_immutable && state.live_isolated
        ? "Coupon infrastructure installed; order writes and audit history remain protected."
        : "Coupon infrastructure not installed; orders unchanged.",
    );
  }
} catch (error) {
  console.error(
    "Coupon setup stopped: " +
      (error instanceof Error ? error.message : "unknown") +
      ". No credentials printed.",
  );
  process.exitCode = 1;
}
