// Operator-only launch tooling. SQL results and credentials never reach console output.
import { readFileSync, writeFileSync, renameSync, mkdirSync } from "node:fs";
import {
  randomBytes,
  randomUUID,
  createCipheriv,
  createDecipheriv,
  createHash,
} from "node:crypto";
import { spawnSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import {
  createEsimAccessAPI,
  esimAccessConfig,
} from "../src/lib/integrations/esimaccess-api.ts";
import { compareProviderCatalog } from "../src/lib/integrations/esimaccess-catalog.ts";
import { buildSimcoinsQuote } from "../src/lib/simcoins/engine.ts";
import {
  defaultSimcoinsSettings,
  defaultSimcoinsLevels,
} from "../src/lib/simcoins/config.ts";
process.loadEnvFile(".env.local");
const folder = "private-data/simcoins-launch";
mkdirSync(folder, { recursive: true });
const db = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_CHECKOUT_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
function run(command, input) {
  const r = spawnSync(
    process.env.ComSpec || "cmd.exe",
    ["/d", "/s", "/c", command],
    { input, encoding: "utf8", windowsHide: true, maxBuffer: 80 * 1024 * 1024 },
  );
  if (r.status !== 0) throw Error("operator_command_failed");
  return r.stdout;
}
function save(name, value) {
  let content = readFileSync(".env.local", "utf8");
  const pattern = new RegExp(`^${name}=.*$`, "m"),
    line = `${name}=${JSON.stringify(value)}`;
  content = pattern.test(content)
    ? content.replace(pattern, () => line)
    : `${content.trimEnd()}\n${line}\n`;
  writeFileSync(".env.local.tmp", content, { mode: 0o600 });
  renameSync(".env.local.tmp", ".env.local");
  process.env[name] = value;
}
function sql(text, name) {
  const file = `${folder}/${name}.sql`;
  writeFileSync(file, text, { mode: 0o600 });
  const result = JSON.parse(
    run(`npx.cmd supabase db query --linked --file ${file}`),
  );
  if (!Array.isArray(result.rows)) throw Error("unexpected_database_result");
  return result.rows;
}
let stage = "mode";
try {
  const mode = process.argv[2];
  if (mode === "--backup") {
    stage = "logical export";
    const rows = sql(
      `begin isolation level repeatable read;
      create temporary table mts_launch_backup(schema_name text, table_name text, rows jsonb);
      do $backup$ declare r record; begin
        for r in select schemaname,tablename from pg_tables where schemaname in ('public','auth','storage') loop
          execute format('insert into mts_launch_backup select %L,%L,coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from %I.%I t',r.schemaname,r.tablename,r.schemaname,r.tablename);
        end loop;
      end $backup$;
      select jsonb_build_object('created_at',now(),'scope','public/auth/storage logical data; no cron or vault restore','tables',(select jsonb_agg(to_jsonb(b))from mts_launch_backup b),
        'columns',(select jsonb_agg(to_jsonb(c))from information_schema.columns c where table_schema in ('public','auth','storage')),
        'functions',(select jsonb_agg(jsonb_build_object('schema',n.nspname,'definition',pg_get_functiondef(p.oid)))from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f'),
        'constraints',(select jsonb_agg(jsonb_build_object('table',c.conrelid::regclass::text,'name',c.conname,'definition',pg_get_constraintdef(c.oid)))from pg_constraint c join pg_namespace n on n.oid=c.connamespace where n.nspname in ('public','auth','storage')),
        'indexes',(select jsonb_agg(to_jsonb(i))from pg_indexes i where schemaname in ('public','auth','storage')),
        'triggers',(select jsonb_agg(jsonb_build_object('definition',pg_get_triggerdef(t.oid)))from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname='public'),
        'policies',(select jsonb_agg(to_jsonb(p))from pg_policies p where schemaname='public')) as snapshot;
      rollback;`,
      "backup-query",
    );
    const snapshot = rows[0]?.snapshot;
    if (!snapshot?.tables?.length) throw Error("empty_backup");
    if (!process.env.SIMCOINS_BACKUP_KEY)
      save("SIMCOINS_BACKUP_KEY", randomBytes(32).toString("hex"));
    const key = Buffer.from(process.env.SIMCOINS_BACKUP_KEY, "hex");
    if (key.length !== 32) throw Error("invalid_backup_key");
    const plain = Buffer.from(JSON.stringify(snapshot));
    const iv = randomBytes(12),
      cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
    writeFileSync(
      `${folder}/prelaunch-backup.enc.json`,
      JSON.stringify({
        algorithm: "aes-256-gcm",
        iv: iv.toString("hex"),
        tag: cipher.getAuthTag().toString("hex"),
        sha256: createHash("sha256").update(plain).digest("hex"),
        ciphertext: encrypted.toString("base64"),
      }),
      { mode: 0o600 },
    );
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(cipher.getAuthTag());
    const restored = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    if (!restored.equals(plain)) throw Error("backup_verification_failed");
    console.log(
      `Encrypted logical snapshot saved privately: ${snapshot.tables.length} tables. This is not a proven full disaster-recovery backup.`,
    );
  } else if (mode === "--preflight") {
    stage = "transactional migration validation";
    const migrations = [
      "20261027000300_simcoins.sql",
      "20261027000400_simcoins_analytics.sql",
      "20261027000500_simcoins_worker.sql",
    ];
    const body = migrations
      .map((name) =>
        readFileSync(`supabase/migrations/${name}`, "utf8").replace(
          /^\s*(begin|commit);\s*$/gim,
          "",
        ),
      )
      .join("\n");
    const rows = sql(
      `begin;set local lock_timeout='5s';${body}\nselect (select count(*)from public.simcoins_levels)as levels,not exists(select 1 from public.simcoins_program_settings where enabled or earn_enabled or redeem_enabled)as disabled,not has_function_privilege('anon','public.simcoins_wallet(uuid)','execute')as private_wallet;rollback;`,
      "preflight",
    );
    if (rows[0]?.levels !== 5 || !rows[0]?.disabled || !rows[0]?.private_wallet)
      throw Error("migration_invariants_failed");
    console.log(
      "All launch migrations validated against actual schema in a rolled-back transaction; five levels, disabled settings and private RPC verified.",
    );
  } else if (mode === "--prepare") {
    for (const name of [
      "SIMCOINS_ENABLED",
      "SIMCOINS_EARN_ENABLED",
      "SIMCOINS_REDEEM_ENABLED",
      "SIMCOINS_ADMIN_ENABLED",
      "SIMCOINS_PERSISTENCE_READY",
      "SIMCOINS_PUBLIC_ENABLED",
    ])
      save(name, "true");
    if (!process.env.SIMCOINS_WORKER_SECRET)
      save("SIMCOINS_WORKER_SECRET", randomBytes(32).toString("hex"));
    console.log("Local launch configuration prepared privately.");
  } else if (mode === "--deploy-env") {
    for (const name of [
      "SIMCOINS_ENABLED",
      "SIMCOINS_EARN_ENABLED",
      "SIMCOINS_REDEEM_ENABLED",
      "SIMCOINS_ADMIN_ENABLED",
      "SIMCOINS_PERSISTENCE_READY",
      "SIMCOINS_PUBLIC_ENABLED",
      "SIMCOINS_WORKER_SECRET",
    ]) {
      stage = `configure ${name}`;
      const value = process.env[name];
      if (!value || (name.endsWith("SECRET") && value.length < 32))
        throw Error("missing_configuration");
      run(
        `npx.cmd --yes vercel env add ${name} --environment production --sensitive --force --yes --project mts --scope guzzfirec-1094s-projects`,
        value,
      );
      console.log(`${name}: configured privately.`);
    }
  } else if (mode === "--plans") {
    stage = "verified supplier quotes";
    const remote = await createEsimAccessAPI(
      esimAccessConfig(process.env),
    ).privateCostPackages();
    const plans = [];
    for (let start = 0; ; start += 1000) {
      const r = await db
        .from("catalog_plans")
        .select("id,allowance,days,coverage_code,retail_price_cents")
        .eq("is_published", true)
        .eq("kind", "fixed")
        .order("id")
        .range(start, start + 999);
      if (r.error) throw Error("catalog_read_failed");
      plans.push(...r.data);
      if (r.data.length < 1000) break;
    }
    const identity = compareProviderCatalog(
      plans.map((p) => ({ ...p, coverageCode: p.coverage_code })),
      remote,
    );
    const observed = new Date().toISOString(),
      costs = [],
      eligible = [],
      excluded = [];
    for (const match of identity.matches) {
      const provider = remote.find((p) => p.slug === match.providerSlug),
        plan = plans.find((p) => p.id === match.planId);
      if (!provider?.wholesaleUnitUnits || !plan?.retail_price_cents) continue;
      costs.push({
        plan_id: plan.id,
        wholesale_unit_units: provider.wholesaleUnitUnits,
        observed_at: observed,
        source_ref: "esimaccess:package/list",
      });
      const quote = buildSimcoinsQuote({
        lines: [
          {
            planId: plan.id,
            quantity: 1,
            grossUnitCents: plan.retail_price_cents,
            wholesaleUnitUnits: provider.wholesaleUnitUnits,
            costObservedAt: observed,
            earnEnabled: true,
            redeemEnabled: true,
          },
        ],
        currency: "USD",
        fxRate: "10000000000",
        currencyDecimals: 2,
        availableCoins: 999999,
        requestedCoins: 999999,
        eligibleSpendCents: 30000,
        settings: {
          ...defaultSimcoinsSettings,
          stripeBps: defaultSimcoinsSettings.stripeFxBps,
        },
        levels: defaultSimcoinsLevels,
      });
      if (
        quote.lines[0].earnEligible &&
        quote.lines[0].redeemEligible &&
        quote.rateBps === 600 &&
        quote.maxRedeemCoins === Math.floor(plan.retail_price_cents * 0.05)
      )
        eligible.push({
          plan_id: plan.id,
          earn_enabled: true,
          redeem_enabled: true,
        });
      else
        excluded.push({
          planId: plan.id,
          reason: quote.reason ?? quote.lines[0].reason ?? "margin",
        });
    }
    if (!eligible.length) throw Error("no_verified_eligible_plans");
    writeFileSync(
      `${folder}/margin-review.json`,
      JSON.stringify(
        {
          observed,
          published: plans.length,
          identityMatched: identity.matches.length,
          eligible: eligible.map((x) => x.plan_id),
          excluded,
          missing: identity.missing,
          conflicts: identity.conflicts,
        },
        null,
        2,
      ),
      { mode: 0o600 },
    );
    stage = "persist verified costs";
    for (let i = 0; i < costs.length; i += 200)
      if (
        (
          await db
            .from("simcoins_private_costs")
            .upsert(costs.slice(i, i + 200))
        ).error
      )
        throw Error("cost_save_failed");
    stage = "persist product opt-ins";
    const actor = sql(
      "select user_id from public.admin_memberships order by created_at limit 1",
      "actor",
    )[0]?.user_id;
    if (!actor) throw Error("admin_actor_missing");
    // One audited operator batch; no historical order or retail-price changes.
    const value = JSON.stringify(eligible).replaceAll("'", "''");
    sql(
      `begin;
       create temporary table launch_previous as select count(*)as enabled_count from public.simcoins_product_eligibility where earn_enabled or redeem_enabled;
       update public.simcoins_product_eligibility set earn_enabled=false,redeem_enabled=false,updated_at=now()where(earn_enabled or redeem_enabled)and plan_id not in(select x->>'plan_id'from jsonb_array_elements('${value}'::jsonb)x);
       insert into public.simcoins_product_eligibility(plan_id,earn_enabled,redeem_enabled)select plan_id,earn_enabled,redeem_enabled from jsonb_to_recordset('${value}'::jsonb)as x(plan_id text,earn_enabled boolean,redeem_enabled boolean)on conflict(plan_id)do update set earn_enabled=excluded.earn_enabled,redeem_enabled=excluded.redeem_enabled,updated_at=now();
       update public.simcoins_program_settings set policy_version=policy_version+1,updated_at=now()where id;
       insert into public.simcoins_audit_logs(request_id,actor,action,reason,before_value,after_value)select '${randomUUID()}','${actor}','launch_products','Owner authorized commercial launch; current provider identity and conservative maximum tier, redemption and FX budget verified.',to_jsonb(p),jsonb_build_object('plan_count',${eligible.length},'margin_review','private-data/simcoins-launch/margin-review.json')from launch_previous p;
       select count(*)as plans from public.simcoins_product_eligibility where earn_enabled and redeem_enabled;commit;`,
      "opt-in",
    );
    console.log(
      `Provider identity verified: ${identity.matches.length}/${plans.length}. Opted in ${eligible.length} plans at maximum tier and redemption with conservative FX fee budget; ${excluded.length} margin exclusions. Retail prices unchanged.`,
    );
  } else if (mode === "--verify") {
    stage = "production invariants";
    const rows = sql(
      `select
      (select count(*)from public.simcoins_levels)as levels,
      (select count(*)from public.simcoins_product_eligibility where earn_enabled and redeem_enabled)as eligible_plans,
      (select count(*)from public.checkout_orders where livemode and status='paid')as paid_live_orders,
      (select count(*)from public.simcoins_order_snapshots)as participating_orders,
      (select enabled and earn_enabled and redeem_enabled and admin_enabled from public.simcoins_program_settings where id)as enabled,
      (select count(*)from cron.job where jobname='mts-simcoins-release' and active)as active_jobs,
      not exists(select 1 from pg_tables t where t.schemaname='public' and t.tablename like 'simcoins_%' and(has_table_privilege('anon',format('%I.%I',t.schemaname,t.tablename),'select')or has_table_privilege('authenticated',format('%I.%I',t.schemaname,t.tablename),'insert,update,delete')))as private_tables,
      not has_function_privilege('anon','public.simcoins_wallet(uuid)','execute')and not has_function_privilege('authenticated','public.simcoins_admin_configure(uuid,text,jsonb,text,uuid)','execute')as private_rpc;`,
      "verify",
    );
    const r = rows[0];
    if (
      r?.levels !== 5 ||
      !r?.private_tables ||
      !r?.private_rpc ||
      !r?.eligible_plans
    )
      throw Error("launch_invariants_failed");
    console.log(JSON.stringify(r));
  } else if (mode === "--activate") {
    stage = "audited activation";
    const actor = sql(
      "select user_id from public.admin_memberships order by created_at limit 1",
      "actor",
    )[0]?.user_id;
    if (!actor) throw Error("admin_actor_missing");
    sql(
      `begin;insert into public.simcoins_audit_logs(request_id,actor,action,reason,before_value,after_value)select '${randomUUID()}','${actor}','launch_admin','Owner authorized enabling audited SimCoins administration for commercial launch.',to_jsonb(s),jsonb_build_object('admin_enabled',true)from public.simcoins_program_settings s where id and not admin_enabled;update public.simcoins_program_settings set admin_enabled=true where id and not admin_enabled;select admin_enabled from public.simcoins_program_settings where id;commit;`,
      "bootstrap-admin",
    );
    const r = await db.rpc("simcoins_admin_configure", {
      p_actor: actor,
      p_action: "settings",
      p_value: {
        enabled: true,
        earn_enabled: true,
        redeem_enabled: true,
        admin_enabled: true,
        public_enabled: true,
      },
      p_reason:
        "Owner authorized SimCoins launch in checkout and account levels after migration, margin and release verification.",
      p_request: randomUUID(),
    });
    if (r.error || !r.data?.enabled) throw Error("activation_failed");
    const scheduled = await db.rpc("configure_simcoins_worker");
    if (scheduled.error || scheduled.data !== true)
      throw Error("scheduler_failed");
    console.log(
      "SimCoins earning/redemption and administrative settings activated with audit; idempotent database release worker scheduled every five minutes.",
    );
  } else
    throw Error(
      "Use --backup, --preflight, --prepare, --deploy-env, --plans or --activate",
    );
} catch (error) {
  console.error(
    `SimCoins setup stopped at ${stage}: ${error instanceof Error && /^[a-z_]+$/.test(error.message) ? error.message : "private_operator_error"}. No credentials printed.`,
  );
  process.exitCode = 1;
}
