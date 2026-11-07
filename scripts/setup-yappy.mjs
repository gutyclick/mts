import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
const folder = "private-data/yappy-setup";
mkdirSync(folder, { recursive: true });
function query(file, mutate = false) {
  const result = spawnSync(
    process.env.ComSpec ?? "cmd.exe",
    [
      "/d",
      "/s",
      "/c",
      `npx.cmd supabase db query --linked ${mutate ? "--yes" : "--read-only"} --file ${file}`,
    ],
    { encoding: "utf8", windowsHide: true, maxBuffer: 1024 * 1024 },
  );
  if (result.status !== 0) throw Error("database_command");
  return JSON.parse(result.stdout).rows;
}
try {
  if (
    readFileSync("supabase/.temp/project-ref", "utf8").trim() !==
    "xfdwqalkkjclburzcwlv"
  )
    throw Error("wrong_project");
  const args = process.argv.slice(2);
  if (args.some((a) => !["--check", "--apply"].includes(a)))
    throw Error("mode");
  const check = `select to_regclass('public.checkout_yappy_attempts') is not null as installed,
  to_regprocedure('public.retail_yappy_settle(text,text,text,boolean)') is not null as settlement,
  to_regprocedure('public.admin_record_yappy_refund(uuid,uuid,uuid[],text,text,boolean)') is not null as manual_refunds,
  case when to_regclass('public.checkout_yappy_attempts') is not null then
    not has_table_privilege('anon','public.checkout_yappy_attempts','select') and not has_table_privilege('authenticated','public.checkout_yappy_attempts','select')
    and (select relrowsecurity from pg_class where oid='public.checkout_yappy_attempts'::regclass) else false end as private_attempts,
  case when to_regprocedure('public.retail_yappy_settle(text,text,text,boolean)') is not null then
    not has_function_privilege('anon','public.retail_yappy_settle(text,text,text,boolean)','execute') and not has_function_privilege('authenticated','public.retail_yappy_settle(text,text,text,boolean)','execute') else false end as private_settlement;`;
  writeFileSync(`${folder}/check.sql`, check);
  let state = query(`${folder}/check.sql`)[0];
  if (args.includes("--apply") && !state.installed) {
    query("supabase/migrations/20261107000100_checkout_yappy.sql", true);
    state = query(`${folder}/check.sql`)[0];
  }
  if (args.includes("--apply") && !state.manual_refunds) {
    query("supabase/migrations/20261107000200_yappy_manual_refunds.sql", true);
    state = query(`${folder}/check.sql`)[0];
  }
  writeFileSync(`${folder}/readiness.json`, JSON.stringify(state, null, 2));
  console.log(JSON.stringify({ ...state, activationPerformed: false }));
  if (
    !state.installed ||
    !state.settlement ||
    !state.private_attempts ||
    !state.private_settlement ||
    !state.manual_refunds
  )
    process.exitCode = 1;
} catch {
  console.error(
    "Yappy database setup stopped. No keys, customer data or SQL results printed.",
  );
  process.exitCode = 1;
}
