import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("support ownership, escalation, idempotency, roles, quotas and notification leases", async () => {
  const db = new PGlite(),
    owner = randomUUID(),
    other = randomUUID(),
    staff = randomUUID(),
    order = randomUUID(),
    request = randomUUID();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);grant usage on schema auth to authenticated;create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table public.checkout_orders(id uuid primary key,user_id uuid);create table public.admin_memberships(user_id uuid primary key);`,
    );
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261025001300_support.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261025001600_support_order_selection.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query(
      `insert into auth.users values($1,'customer@example.invalid',now()),($2,'other@example.invalid',now()),($3,'staff@example.invalid',now())`,
      [owner, other, staff],
    );
    await db.query("insert into admin_memberships values($1)", [staff]);
    await db.query("insert into checkout_orders values($1,$2)", [order, owner]);
    await assert.rejects(
      db.query("select support_chat_start($1,null,$2,$3,$4,$5,$6)", [
        other,
        randomUUID(),
        "Hello",
        "auto",
        "es",
        order,
      ]),
      /order_unavailable/,
    );
    const start = (
      await db.query("select support_chat_start($1,null,$2,$3,$4,$5,$6)as d", [
        owner,
        request,
        "My data is not working",
        "auto",
        "es",
        order,
      ])
    ).rows[0].d;
    await assert.rejects(
      db.query("select support_chat_start($1,$2,$3,$4,$5,$6,null)", [
        other,
        start.id,
        randomUUID(),
        "Other question",
        "auto",
        "es",
      ]),
      /thread_unavailable/,
    );
    assert.equal(
      (
        await db.query(
          "select support_chat_finish($1,$2,$3,$4,$5,$6,true) as d",
          [owner, start.id, randomUUID(), request, "Answer", "[]"],
        )
      ).rows[0].d,
      null,
    );
    await db.query("select support_chat_finish($1,$2,$3,$4,$5,$6,true)", [
      owner,
      start.id,
      start.token,
      request,
      "Use the official guide",
      "[]",
    ]);
    const replay = (
      await db.query("select support_chat_start($1,null,$2,$3,$4,$5,$6)as d", [
        owner,
        request,
        "My data is not working",
        "auto",
        "es",
        order,
      ])
    ).rows[0].d;
    assert.equal(replay.replay, true);
    assert.equal(replay.answer.body, "Use the official guide");
    const nextRequest = randomUUID(),
      next = (
        await db.query(
          "select support_chat_start($1,$2,$3,$4,$5,$6,null)as d",
          [owner, start.id, nextRequest, "Still not working", "auto", "es"],
        )
      ).rows[0].d;
    assert.equal(
      (
        await db.query("select order_id from support_threads where id=$1", [
          start.id,
        ])
      ).rows[0].order_id,
      null,
    );
    const ticketRequest = randomUUID(),
      params = [
        owner,
        start.id,
        ticketRequest,
        "Connection help",
        "Please help me connect",
        "auto",
        "es",
        order,
      ];
    const ticket = (
      await db.query(
        "select support_ticket_create($1,$2,$3,$4,$5,$6,$7,$8)as id",
        params,
      )
    ).rows[0].id;
    assert.equal(
      (
        await db.query(
          "select support_ticket_create($1,$2,$3,$4,$5,$6,$7,$8)as id",
          params,
        )
      ).rows[0].id,
      ticket,
    );
    assert.equal(
      (
        await db.query(
          "select support_chat_finish($1,$2,$3,$4,$5,$6,true)as d",
          [owner, ticket, next.token, nextRequest, "Late response", "[]"],
        )
      ).rows[0].d,
      null,
    );
    assert.equal(
      (await db.query("select count(*)::int as n from support_messages"))
        .rows[0].n,
      4,
    );
    assert.equal(
      (await db.query("select recipient from support_notifications")).rows[0]
        .recipient,
      "hello@mytripsim.com",
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(
        db.query("select support_ticket_list($1,true,$2,$3,1)", [
          staff,
          "",
          "",
        ]),
        /permission denied/,
      );
      await assert.rejects(
        db.query(
          "insert into support_threads(user_id,subject,locale)values($1,$2,$3)",
          [other, "Forged", "es"],
        ),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select * from support_notifications"),
        /permission denied/,
      );
      await db.exec("reset role");
    }
    await db.exec("set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      other,
    ]);
    assert.equal(
      (await db.query("select id from support_threads")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select id from support_messages")).rows.length,
      0,
    );
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      owner,
    ]);
    assert.equal(
      (await db.query("select id from support_threads")).rows.length,
      1,
    );
    await assert.rejects(
      db.query("select chat_token from support_threads"),
      /permission denied/,
    );
    await db.exec("reset role");
    await assert.rejects(
      db.query("select support_ticket_reply($1,$2,$3,$4,true)", [
        other,
        ticket,
        randomUUID(),
        "Forged staff",
      ]),
      /admin_required/,
    );
    await assert.rejects(
      db.query("select support_ticket_reply($1,$2,$3,$4,false)", [
        other,
        ticket,
        randomUUID(),
        "Forged owner",
      ]),
      /ticket_unavailable/,
    );
    const reply = randomUUID();
    await db.query("select support_ticket_reply($1,$2,$3,$4,true)", [
      staff,
      ticket,
      reply,
      "We can help",
    ]);
    await db.query("select support_ticket_reply($1,$2,$3,$4,true)", [
      staff,
      ticket,
      reply,
      "We can help",
    ]);
    assert.equal(
      (await db.query("select status from support_threads")).rows[0].status,
      "waiting_customer",
    );
    assert.equal(
      (
        await db.query(
          "select recipient from support_notifications where kind='agent_reply'",
        )
      ).rows[0].recipient,
      "customer@example.invalid",
    );
    await db.query("select support_ticket_resolve($1,$2,true)", [
      staff,
      ticket,
    ]);
    await db.query("select support_ticket_reply($1,$2,$3,$4,false)", [
      owner,
      ticket,
      randomUUID(),
      "Another question",
    ]);
    assert.equal(
      (await db.query("select status from support_threads")).rows[0].status,
      "open",
    );
    assert.equal(
      (
        await db.query("select support_ticket_list($1,false,$2,$3,1)as d", [
          other,
          "",
          "",
        ])
      ).rows[0].d.total,
      0,
    );
    assert.equal(
      (
        await db.query("select support_ticket_list($1,true,$2,$3,1)as d", [
          staff,
          "",
          "customer@",
        ])
      ).rows[0].d.total,
      1,
    );
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261025001700_support_delivery_guard.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    assert.equal(
      (await db.query("select * from support_claim_notifications(2)")).rows
        .length,
      0,
    );
    await db.exec(
      "update support_settings set delivery_enabled=true where id=true",
    );
    const claim = (
      await db.query("select * from support_claim_notifications(2)")
    ).rows;
    assert.equal(claim.length, 2);
    assert.notEqual(claim[0].lease_token, claim[1].lease_token);
    assert.equal(
      (await db.query("select * from support_claim_notifications(2)")).rows
        .length,
      1,
    );
    await db.exec(
      "update support_notifications set lease_until=now()-interval '1 second',first_attempt_at=now()-interval '24 hours'",
    );
    assert.equal(
      (await db.query("select * from support_claim_notifications(2)")).rows
        .length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from support_notifications where state='failed'",
        )
      ).rows[0].n,
      3,
    );
    for (const period of ["hour", "day"]) {
      assert.equal(
        (
          await db.query("select support_take_quota($1,1,$2)as ok", [
            period,
            period,
          ])
        ).rows[0].ok,
        true,
      );
      assert.equal(
        (
          await db.query("select support_take_quota($1,1,$2)as ok", [
            period,
            period,
          ])
        ).rows[0].ok,
        false,
      );
    }
  } finally {
    await db.close();
  }
});
