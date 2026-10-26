import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import {
  conversationRequest,
  conversationDeadline,
} from "../src/lib/support/conversations.ts";

test("conversation commands are bounded and ten-minute deadlines do not reset on reads", () => {
  assert.equal(
    conversationDeadline("2026-10-26T12:00:00Z", 600),
    "2026-10-26T12:10:00.000Z",
  );
  assert.ok(
    conversationRequest.safeParse({
      action: "rate",
      threadId: randomUUID(),
      rating: 5,
    }).success,
  );
  for (const rating of [0, 6, 2.5, "5"])
    assert.ok(
      !conversationRequest.safeParse({
        action: "rate",
        threadId: randomUUID(),
        rating,
      }).success,
    );
  assert.ok(
    !conversationRequest.safeParse({
      action: "close",
      threadId: randomUUID(),
      reason: "inactivity",
      userId: randomUUID(),
    }).success,
  );
});

test("conversation lifecycle isolates guests and accounts, closes idle chats and records one owned rating", async () => {
  const db = new PGlite();
  const user = randomUUID(),
    other = randomUUID(),
    staff = randomUUID(),
    guest = "a".repeat(64),
    foreignGuest = "b".repeat(64);
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);grant usage on schema auth to authenticated;create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table public.checkout_orders(id uuid primary key,user_id uuid);create table public.admin_memberships(user_id uuid primary key);`,
    );
    for (const file of [
      "20261025001300_support.sql",
      "20261025001600_support_order_selection.sql",
      "20261026000200_support_conversations.sql",
    ])
      await db.exec(
        readFileSync(
          new URL(`../supabase/migrations/${file}`, import.meta.url),
          "utf8",
        ),
      );
    await db.query(
      "insert into auth.users values($1,'owner@example.invalid',now()),($2,'other@example.invalid',now()),($3,'staff@example.invalid',now())",
      [user, other, staff],
    );
    await db.query("insert into admin_memberships values($1)", [staff]);
    const open = (actor, hash, id = randomUUID()) =>
      db.query(
        "select support_conversation_open($1,$2,$3,'installation','Install my eSIM','en','auto') as t",
        [actor, hash, id],
      );
    const close = (actor, hash, id, reason = "resolved") =>
      db.query("select support_conversation_close($1,$2,$3,$4) as t", [
        actor,
        hash,
        id,
        reason,
      ]);
    const start = (
      actor,
      hash,
      id,
      request = randomUUID(),
      text = "How do I install?",
    ) =>
      db.query(
        "select support_conversation_chat_start($1,$2,$3,$4,$5,'auto',null) as d",
        [actor, hash, id, request, text],
      );
    const finish = (actor, hash, id, pending, request) =>
      db.query(
        "select support_conversation_chat_finish($1,$2,$3,$4,$5,'Install with Wi-Fi','[]',true) as d",
        [actor, hash, id, pending.token, request],
      );
    const rate = (actor, hash, id, score = 5, comment = "Clear help") =>
      db.query("select support_conversation_rate($1,$2,$3,$4,$5) as t", [
        actor,
        hash,
        id,
        score,
        comment,
      ]);
    const own = (await open(user, null)).rows[0].t,
      anonymous = (await open(null, guest)).rows[0].t;
    await assert.rejects(open(other, null, own.id), /thread_unavailable/);
    await assert.rejects(open(null, guest, own.id), /thread_unavailable/);
    await assert.rejects(open(user, null, anonymous.id), /thread_unavailable/);
    await assert.rejects(
      close(null, foreignGuest, anonymous.id),
      /thread_unavailable/,
    );
    await assert.rejects(close(other, null, own.id), /thread_unavailable/);
    await assert.rejects(open(null, guest), /active_conversation/);
    const request = randomUUID(),
      pending = (await start(null, guest, anonymous.id, request)).rows[0].d;
    await finish(null, guest, anonymous.id, pending, request);
    await assert.rejects(
      rate(null, guest, anonymous.id),
      /conversation_active/,
    );
    assert.equal(
      (await close(null, guest, anonymous.id, "inactivity")).rows[0].t.status,
      "chat",
    );
    await db.query(
      "update support_threads set updated_at=now()-interval '11 minutes' where id=$1",
      [anonymous.id],
    );
    assert.equal(
      (await db.query("select support_expire_conversations() as n")).rows[0].n,
      1,
    );
    const ended = (await close(null, guest, anonymous.id)).rows[0].t;
    assert.equal(ended.close_reason, "inactivity");
    assert.equal(ended.status, "resolved");
    await assert.rejects(rate(user, null, anonymous.id), /thread_unavailable/);
    assert.equal((await rate(null, guest, anonymous.id)).rows[0].t.rating, 5);
    await rate(null, guest, anonymous.id);
    await assert.rejects(rate(null, guest, anonymous.id, 1), /already_rated/);
    assert.equal(
      (await start(null, guest, anonymous.id)).rows[0].d.closed,
      true,
    );
    const next = (await open(null, guest)).rows[0].t;
    assert.notEqual(next.id, anonymous.id);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from support_messages where thread_id=$1",
          [next.id],
        )
      ).rows[0].n,
      0,
    );
    const inFlight = randomUUID(),
      running = (await start(user, null, own.id, inFlight)).rows[0].d;
    await close(user, null, own.id);
    assert.equal(
      (await finish(user, null, own.id, running, inFlight)).rows[0].d,
      null,
    );
    await assert.rejects(
      db.query("select support_ticket_reply($1,$2,$3,'Reopen',false)", [
        user,
        own.id,
        randomUUID(),
      ]),
      /conversation_closed/,
    );
    // Human tickets remain open despite inactivity, and staff can see actual feedback.
    await db.query(
      "update support_threads set status='open',escalated_at=now(),updated_at=now()-interval '2 days' where id=$1",
      [next.id],
    );
    await db.query("select support_expire_conversations()");
    assert.equal(
      (await close(null, guest, next.id, "inactivity")).rows[0].t.status,
      "open",
    );
    const list = (
      await db.query("select support_ticket_list($1,true,'','',1) as d", [
        staff,
      ])
    ).rows[0].d;
    assert.equal(list.rows.find((t) => t.id === anonymous.id).rating, 5);
    await db.exec("set role anon");
    await assert.rejects(open(null, guest), /permission denied/);
    await assert.rejects(
      db.query("select * from support_messages"),
      /permission denied/,
    );
    await db.exec("reset role");
    await db.query(
      "update support_threads set updated_at=now()-interval '31 days' where id=$1",
      [anonymous.id],
    );
    await db.query("select support_expire_conversations()");
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from support_threads where id=$1",
          [anonymous.id],
        )
      ).rows[0].n,
      0,
    );
  } finally {
    await db.close();
  }
});
