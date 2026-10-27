import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  simcoinsClientEventSchema,
  simcoinsEventPathAllowed,
} from "../src/lib/simcoins/analytics.ts";

test("browser SimCoins telemetry cannot assert financial events or carry private fields", () => {
  const valid = { kind: "simcoins_landing_view", nonce: randomUUID() };
  assert.ok(simcoinsClientEventSchema.safeParse(valid).success);
  for (const kind of [
    "simcoins_earned",
    "simcoins_redeemed",
    "simcoins_level_up",
    "simcoins_return_purchase",
  ])
    assert.equal(
      simcoinsClientEventSchema.safeParse({ ...valid, kind }).success,
      false,
    );
  for (const key of [
    "email",
    "userId",
    "orderId",
    "balance",
    "coins",
    "wholesale",
    "url",
  ])
    assert.equal(
      simcoinsClientEventSchema.safeParse({ ...valid, [key]: "private" })
        .success,
      false,
    );
  assert.equal(
    simcoinsClientEventSchema.safeParse({ kind: valid.kind, nonce: "invalid" })
      .success,
    false,
  );
});

test("only explicit checkout redemption intent is measured on private commerce paths", () => {
  assert.equal(
    simcoinsEventPathAllowed("simcoins_checkout_redeem", "/es/compra"),
    true,
  );
  assert.equal(
    simcoinsEventPathAllowed("simcoins_landing_view", "/es/simcoins"),
    true,
  );
  assert.equal(simcoinsEventPathAllowed("simcoins_join", "/en/simcoins"), true);
  assert.equal(
    simcoinsEventPathAllowed("simcoins_checkout_redeem", "/es/checkout"),
    true,
  );
  for (const path of [
    "/es/account/simcoins",
    "/es/admin/simcoins",
    "/es/checkout/result",
    "/es/esim/access",
    "/es/simcoins?email=private",
  ])
    for (const kind of [
      "simcoins_landing_view",
      "simcoins_join",
      "simcoins_checkout_redeem",
    ])
      assert.equal(simcoinsEventPathAllowed(kind, path), false);
  assert.equal(
    simcoinsEventPathAllowed("simcoins_landing_view", "/es/checkout"),
    false,
  );
});

test("consent cohorts own private idempotent events and financial postings alone assert results", async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create table analytics_cohorts(hash text primary key,created_at timestamptz default now());
      create table analytics_revoked(hash text primary key,expires_at timestamptz);
      create table checkout_orders(id uuid primary key,status text,livemode boolean,analytics_cohort text references analytics_cohorts(hash)on delete set null,analytics_order_key uuid);
      create table simcoins_levels(threshold_cents bigint);
      insert into simcoins_levels values(0),(1),(6000);
      create table simcoins_transactions(id bigint generated always as identity,account_id uuid,order_id uuid,kind text,coin_delta bigint,spend_delta_cents bigint);
    `);
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261027000400_simcoins_analytics.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const hash = "a".repeat(64),
      nonce = randomUUID(),
      order = randomUUID(),
      nextOrder = randomUUID(),
      account = randomUUID();
    await db.query("insert into analytics_cohorts(hash)values($1)", [hash]);
    const record = (kind, id = nonce) =>
      db.query("select simcoins_record_client_event($1,$2,$3)as ok", [
        hash,
        kind,
        id,
      ]);
    assert.equal((await record("simcoins_landing_view")).rows[0].ok, true);
    assert.equal((await record("simcoins_landing_view")).rows[0].ok, false);
    assert.equal(
      (await record("simcoins_earned", randomUUID())).rows[0].ok,
      false,
    );
    for (const id of [order, nextOrder])
      await db.query(
        "insert into checkout_orders values($1,'paid',true,$2,$3)",
        [id, hash, randomUUID()],
      );
    await db.query(
      "insert into simcoins_transactions(account_id,order_id,kind,coin_delta,spend_delta_cents)values($1,$2,'RESERVE',-5,0)",
      [account, order],
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from simcoins_analytics_events",
        )
      ).rows[0].n,
      1,
    );
    await db.query(
      "insert into simcoins_transactions(account_id,order_id,kind,coin_delta,spend_delta_cents)values($1,$2,'EARN',0,100)",
      [account, order],
    );
    await db.query(
      "insert into simcoins_transactions(account_id,order_id,kind,coin_delta,spend_delta_cents)values($1,$2,'EARN',3,100),($1,$2,'EARN',3,100),($1,$2,'CONSUME',-5,0)",
      [account, nextOrder],
    );
    const kinds = (
      await db.query(
        "select kind,count(*)::int as n from simcoins_analytics_events group by kind",
      )
    ).rows;
    assert.equal(kinds.find((row) => row.kind === "simcoins_earned").n, 1);
    assert.equal(kinds.find((row) => row.kind === "simcoins_redeemed").n, 1);
    assert.equal(
      kinds.find((row) => row.kind === "simcoins_return_purchase").n,
      1,
    );
    assert.equal(kinds.find((row) => row.kind === "simcoins_level_up").n, 1);
    await db.exec("set role authenticated");
    await assert.rejects(db.query("select * from simcoins_analytics_events"));
    await db.exec("reset role");
    await db.query("delete from analytics_cohorts where hash=$1", [hash]);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from simcoins_analytics_events",
        )
      ).rows[0].n,
      0,
    );
    assert.equal(
      (await record("simcoins_join", randomUUID())).rows[0].ok,
      false,
    );
  } finally {
    await db.close();
  }
});
