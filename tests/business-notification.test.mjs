import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

const source = readFileSync(
  new URL("../src/lib/portal/notification-server.ts", import.meta.url),
  "utf8",
);
const {
  businessNotificationEmail,
  sendBusinessNotification,
  runBusinessNotificationWorker: run,
} = await import(
  `data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source.replace('import "server-only";', ""))).toString("base64")}`
);
const migration = readFileSync(
  new URL(
    "../supabase/migrations/20261105000400_business_notifications.sql",
    import.meta.url,
  ),
  "utf8",
);
const job = () => ({
  id: randomUUID(),
  order_id: randomUUID(),
  trip_id: randomUUID(),
  recipient_email: "verified@example.invalid",
  locale: "es",
  first_attempt_at: new Date(Date.now() - 1000).toISOString(),
  attempts: 1,
  lease_token: randomUUID(),
});

async function fixture() {
  const db = new PGlite();
  const ids = {
    admin: randomUUID(),
    owner: randomUUID(),
    creator: randomUUID(),
    company: randomUUID(),
    order: randomUUID(),
    request: randomUUID(),
    trip: randomUUID(),
  };
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
  create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,raw_user_meta_data jsonb default '{}',banned_until timestamptz,deleted_at timestamptz);
  create table public.admin_memberships(user_id uuid primary key);
  create table public.b2b_organizations(id uuid primary key,status text);
  create table public.b2b_memberships(company_id uuid,user_id uuid,role text,created_at timestamptz default now());
  create table public.b2b_order_requests(id uuid primary key,created_by uuid);
  create table public.b2b_orders(id uuid primary key,request_id uuid,company_id uuid,trip_id uuid,state text,paid_at timestamptz,released_at timestamptz,quantity integer);
  create table public.b2b_units(id uuid primary key default gen_random_uuid(),order_id uuid,state text);
  create table public.b2b_audit_logs(company_id uuid,actor uuid,action text,entity_id uuid,after_value jsonb);
  insert into auth.users(id,email,email_confirmed_at) values('${ids.admin}','admin@example.invalid',now()),('${ids.owner}','owner@example.invalid',now()),('${ids.creator}','creator@example.invalid',now());
  insert into admin_memberships values('${ids.admin}');insert into b2b_organizations values('${ids.company}','active');
  insert into b2b_memberships(company_id,user_id,role) values('${ids.company}','${ids.owner}','owner'),('${ids.company}','${ids.creator}','coordinator');
  insert into b2b_order_requests values('${ids.request}','${ids.creator}');
  insert into b2b_orders values('${ids.order}','${ids.request}','${ids.company}','${ids.trip}','ready',now(),now(),2);
  insert into b2b_units(order_id,state) values('${ids.order}','ready'),('${ids.order}','ready');`);
  await db.exec(migration);
  const enqueue = () =>
    db.query("select b2b_notification_enqueue($1,$2) id", [
      ids.admin,
      ids.order,
    ]);
  const claim = async () =>
    (await db.query("select claim_b2b_notifications(2) jobs")).rows[0].jobs;
  return { db, ids, enqueue, claim };
}

test("admin enqueue requires paid ready order and creates one job for verified creator", async () => {
  const f = await fixture();
  try {
    await assert.rejects(
      f.db.query("select b2b_notification_enqueue($1,$2)", [
        f.ids.owner,
        f.ids.order,
      ]),
      /admin_required/,
    );
    await f.db.exec(
      `update b2b_units set state='provider_pending' where id=(select id from b2b_units limit 1)`,
    );
    await assert.rejects(f.enqueue(), /ready_units_required/);
    await f.db.exec("update b2b_units set state='ready'");
    const first = (await f.enqueue()).rows[0].id;
    assert.equal((await f.enqueue()).rows[0].id, first);
    const rows = (await f.db.query("select * from b2b_notifications")).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].recipient_id, f.ids.creator);
    await f.db.exec("set role authenticated");
    await assert.rejects(
      f.db.query("select b2b_notification_enqueue($1,$2)", [
        f.ids.admin,
        f.ids.order,
      ]),
      /permission denied/,
    );
    await assert.rejects(
      f.db.query("select * from b2b_notifications"),
      /permission denied/,
    );
  } finally {
    await f.db.close();
  }
});

test("unverified creator falls back to owner; leases fence completion and retry preserves identity/time", async () => {
  const f = await fixture();
  try {
    await f.db.query(
      "update auth.users set email_confirmed_at=null where id=$1",
      [f.ids.creator],
    );
    await f.enqueue();
    const [n] = await f.claim();
    assert.equal(n.recipient_email, "owner@example.invalid");
    assert.deepEqual(await f.claim(), []);
    assert.equal(
      (
        await f.db.query(
          "select complete_b2b_notification($1,$2,null,'transient') ok",
          [n.id, randomUUID()],
        )
      ).rows[0].ok,
      false,
    );
    await f.db.query(
      "select complete_b2b_notification($1,$2,null,'transient')",
      [n.id, n.lease_token],
    );
    await f.db.exec(
      "update b2b_notifications set next_attempt_at=now()-interval '1 second'",
    );
    const [retry] = await f.claim();
    assert.equal(retry.id, n.id);
    assert.equal(retry.first_attempt_at, n.first_attempt_at);
    assert.equal(retry.attempts, 2);
    await f.db.query("select complete_b2b_notification($1,$2,$3,null)", [
      retry.id,
      retry.lease_token,
      randomUUID(),
    ]);
    assert.deepEqual(await f.claim(), []);
    assert.equal(
      (await f.db.query("select state from b2b_notifications")).rows[0].state,
      "sent",
    );
  } finally {
    await f.db.close();
  }
});

test("uncertain attempts older than 23 hours and revoked recipients stop for review", async () => {
  for (const expired of [true, false]) {
    const f = await fixture();
    try {
      await f.enqueue();
      if (expired)
        await f.db.exec(
          "update b2b_notifications set first_attempt_at=now()-interval '23 hours'",
        );
      else
        await f.db.query("delete from b2b_memberships where user_id=$1", [
          f.ids.creator,
        ]);
      assert.deepEqual(await f.claim(), []);
      assert.equal(
        (await f.db.query("select state from b2b_notifications")).rows[0].state,
        "review",
      );
      await f.enqueue();
      assert.equal(
        (await f.db.query("select count(*)::int n from b2b_notifications"))
          .rows[0].n,
        1,
      );
    } finally {
      await f.db.close();
    }
  }
});

test("offline Resend adapter uses stable one-order job key and private portal links only", async () => {
  const n = job(),
    requests = [];
  const emailId = randomUUID();
  const fake = async (url, options) => {
    requests.push({ url, options });
    return Response.json({ id: emailId });
  };
  await sendBusinessNotification(n, "re_offline_test", fake);
  await sendBusinessNotification(n, "re_offline_test", fake);
  assert.equal(
    requests[0].options.headers["Idempotency-Key"],
    requests[1].options.headers["Idempotency-Key"],
  );
  const body = JSON.parse(requests[0].options.body);
  assert.match(
    body.html,
    new RegExp(`https://portal.mytripsim.com/es/viajes/${n.trip_id}`),
  );
  assert.equal(body.attachments, undefined);
  assert.doesNotMatch(body.html, /LPA:|activation|iccid|utm_|<img/);
  assert.match(
    businessNotificationEmail({ ...n, locale: "en" }).text,
    /\/en\/trips\//,
  );
  await assert.rejects(
    sendBusinessNotification(n, "re_offline_test", async () =>
      Response.json({}, { status: 422 }),
    ),
    (error) => error.code === "permanent",
  );
  await assert.rejects(
    sendBusinessNotification(n, "re_offline_test", async () => {
      throw Error("timeout");
    }),
    (error) => error.code === "transient",
  );
});

test("worker flag and uncertainty window prevent sends; partial failure is isolated", async () => {
  const n = job(),
    calls = [];
  const deps = {
    claim: async () => [n],
    send: async (row) => {
      calls.push(row.id);
      return randomUUID();
    },
    complete: async () => {},
  };
  delete process.env.B2B_ISSUANCE_ENABLED;
  assert.equal((await run(deps)).disabled, true);
  assert.deepEqual(calls, []);
  process.env.B2B_ISSUANCE_ENABLED = "true";
  const old = {
    ...job(),
    first_attempt_at: new Date(Date.now() - 23 * 3600000).toISOString(),
  };
  const completed = [];
  deps.claim = async () => [old, n];
  deps.complete = async (row, id, error) =>
    completed.push({ job: row.id, id, error });
  assert.deepEqual(await run(deps), { processed: 2, failed: 1 });
  assert.deepEqual(calls, [n.id]);
  assert.equal(completed[0].error, "uncertain");
  assert.equal(completed[1].error, null);
});
