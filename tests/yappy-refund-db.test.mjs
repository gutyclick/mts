import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { fixture } from "./helpers/yappy-db-fixture.mjs";
test("verified external Yappy refund uses the common ledger, net unit amounts and reward hooks without Stripe IDs", async () => {
  const { db, order, claim, settle } = await fixture();
  try {
    await db.exec(
      `create table admin_memberships(user_id uuid primary key);alter table checkout_order_items add column payment_unit_amount int;create table reward_reversals(refund_id uuid primary key,amount int);`,
    );
    const base = readFileSync(
      "supabase/migrations/20261026000600_admin_refunds.sql",
      "utf8",
    );
    await db.exec(
      base.slice(
        0,
        base.indexOf("create function public.admin_refund_request"),
      ) + "\ncommit;",
    );
    await db.exec(
      `create function simcoins_refund_order(p_refund uuid)returns void language sql as $$insert into public.reward_reversals select p_refund,sum(amount)::int from public.refund_units where request_id=p_refund on conflict do nothing$$;`,
    );
    const sc = readFileSync(
      "supabase/migrations/20261027000300_simcoins.sql",
      "utf8",
    );
    const hookStart = sc.indexOf(
      "create function public.simcoins_refund_trigger()",
    );
    const hookEnd = sc.indexOf(
      "\n",
      sc.indexOf("create trigger simcoins_refund_transition", hookStart),
    );
    await db.exec(sc.slice(hookStart, hookEnd));
    await db.exec(
      readFileSync(
        "supabase/migrations/20261107000200_yappy_manual_refunds.sql",
        "utf8",
      ),
    );
    const actor = randomUUID(),
      outsider = randomUUID();
    await db.query("insert into admin_memberships values($1)", [actor]);
    const id = await order();
    await db.query(
      "update checkout_order_items set payment_unit_amount=350 where order_id=$1",
      [id],
    );
    await claim(id);
    await settle("abcdef123456789", "E");
    const units = (
      await db.query("select id from esim_fulfillments order by id")
    ).rows.map((x) => x.id);
    const record = (
      who = actor,
      ref = "receipt-001",
      selected = [units[0]],
      ack = true,
    ) =>
      db.query(
        `select admin_record_yappy_refund($1,$2,$3,'Verified external customer refund',$4,$5) id`,
        [who, id, selected, ref, ack],
      );
    await assert.rejects(record(outsider));
    await assert.rejects(record(actor, "receipt-001", [units[0]], false));
    const first = (await record()).rows[0].id;
    assert.equal((await record()).rows[0].id, first);
    const refund = (
      await db.query("select * from refund_requests where id=$1", [first])
    ).rows[0];
    assert.equal(refund.amount, 350);
    assert.equal(refund.payment_provider, "yappy");
    assert.equal(refund.payment_intent, null);
    assert.equal(refund.stripe_refund_id, null);
    assert.equal(refund.state, "succeeded");
    assert.deepEqual(
      (await db.query("select amount from reward_reversals")).rows,
      [{ amount: 350 }],
    );
    await assert.rejects(record(actor, "receipt-002", [units[0]]));
    await assert.rejects(
      db.query(`update refund_requests set state='processing' where id=$1`, [
        first,
      ]),
    );
    await record(actor, "receipt-002", [units[1]]);
    assert.equal(
      (await db.query("select sum(amount)::int amount from refund_requests"))
        .rows[0].amount,
      700,
    );
    await db.exec("set role authenticated");
    await assert.rejects(record());
    await assert.rejects(
      db.query("select * from checkout_yappy_refund_receipts"),
    );
  } finally {
    await db.close();
  }
});
