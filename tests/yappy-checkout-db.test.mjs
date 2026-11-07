import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./helpers/yappy-db-fixture.mjs";

test("authoritative success enqueues exact quantity once; duplicates and later failures never undo paid", async () => {
  const { db, order, claim, settle } = await fixture();
  try {
    const id = await order();
    await claim(id);
    const hold = (
      await db.query(
        "select payment_hold_started_at is not null as started, payment_hold_expires_at=payment_hold_started_at+interval '5 minutes' as consistent from checkout_orders where id=$1",
        [id],
      )
    ).rows[0];
    assert.equal(hold.started, true);
    assert.equal(hold.consistent, true);
    assert.equal(
      (await db.query("select count(*)::int n from esim_fulfillments")).rows[0]
        .n,
      0,
    );
    await db.query(
      `select retail_yappy_bind($1,'abcdef123456789','fixture-transaction')`,
      [id],
    );
    assert.equal((await settle("abcdef123456789", "E")).rows[0].state, "paid");
    assert.equal(
      (await settle("abcdef123456789", "E")).rows[0].state,
      "duplicate",
    );
    assert.equal(
      (await settle("abcdef123456789", "R")).rows[0].state,
      "already_paid",
    );
    const jobs = (
      await db.query(
        "select state,provider_transaction_id from esim_fulfillments",
      )
    ).rows;
    assert.equal(jobs.length, 2);
    assert.ok(jobs.every((j) => j.state === "queued"));
    assert.notEqual(
      jobs[0].provider_transaction_id,
      jobs[1].provider_transaction_id,
    );
    assert.equal(
      (
        await db.query(
          "select stripe_session_id,stripe_payment_intent,status from checkout_orders where id=$1",
          [id],
        )
      ).rows[0].stripe_payment_intent,
      null,
    );
  } finally {
    await db.close();
  }
});
test("mismatches, missing acceptance, duplicate creation, and forged amount cannot settle", async () => {
  const { db, order, claim, settle } = await fixture();
  try {
    const noTerms = await order({ terms: false });
    await assert.rejects(claim(noTerms));
    const id = await order();
    await claim(id);
    await assert.rejects(claim(id));
    await assert.rejects(
      settle("abcdef123456789", "E", "https://portal.mytripsim.com"),
    );
    await assert.rejects(
      settle("abcdef123456789", "E", "https://www.mytripsim.com", false),
    );
    await db.query("update checkout_orders set payment_total=799 where id=$1", [
      id,
    ]);
    await assert.rejects(settle("abcdef123456789", "E"));
    assert.equal(
      (await db.query("select count(*)::int n from esim_fulfillments")).rows[0]
        .n,
      0,
    );
  } finally {
    await db.close();
  }
});
test("expiry followed by late signed success is recorded once; test payments cannot emit live profiles", async () => {
  const { db, order, claim, settle } = await fixture();
  try {
    const id = await order({ live: false });
    await claim(id, "123456789abcdef", false);
    assert.equal(
      (await settle("123456789abcdef", "X", "https://www.mytripsim.com", false))
        .rows[0].state,
      "expired",
    );
    assert.equal(
      (await settle("123456789abcdef", "E", "https://www.mytripsim.com", false))
        .rows[0].state,
      "paid",
    );
    assert.ok(
      (await db.query("select state from esim_fulfillments")).rows.every(
        (j) => j.state === "test_skipped",
      ),
    );
    await db.exec("set role authenticated");
    await assert.rejects(db.query("select * from checkout_yappy_attempts"));
    await assert.rejects(
      settle("123456789abcdef", "E", "https://www.mytripsim.com", false),
    );
  } finally {
    await db.close();
  }
});
