import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

test("release scheduling is explicit, private and idempotent, and requires an enabled program", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role;
      create table simcoins_program_settings(id boolean primary key, enabled boolean);
      insert into simcoins_program_settings values(true,false);
      create schema cron; create table cron.jobs(name text primary key,schedule text,command text);
      create function cron.schedule(text,text,text) returns bigint language plpgsql as $$
        begin insert into cron.jobs values($1,$2,$3) on conflict(name) do update set schedule=excluded.schedule,command=excluded.command;return 1;end;$$;`);
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261027000500_simcoins_worker.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.equal(
      (await db.query("select count(*)::int n from cron.jobs")).rows[0].n,
      0,
    );
    await assert.rejects(
      db.query("select configure_simcoins_worker()"),
      /simcoins_disabled/,
    );
    const privileges = (
      await db.query(
        "select has_function_privilege('anon','configure_simcoins_worker()','execute') a,has_function_privilege('authenticated','configure_simcoins_worker()','execute') u,has_function_privilege('service_role','configure_simcoins_worker()','execute') s",
      )
    ).rows[0];
    assert.deepEqual(privileges, { a: false, u: false, s: true });
    await db.exec(
      "update simcoins_program_settings set enabled=true;select configure_simcoins_worker();select configure_simcoins_worker();",
    );
    assert.deepEqual((await db.query("select * from cron.jobs")).rows, [
      {
        name: "mts-simcoins-release",
        schedule: "*/5 * * * *",
        command: "select public.simcoins_release_due(100)",
      },
    ]);
  } finally {
    await db.close();
  }
});
