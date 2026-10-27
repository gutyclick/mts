import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { buildSimcoinsQuote } from "../src/lib/simcoins/engine.ts";

const migration = new URL(
  "../supabase/migrations/20261027000300_simcoins.sql",
  import.meta.url,
);
async function fixture() {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as 'select null::uuid';
    create table catalog_plans(id text primary key,retail_price_cents int,is_published bool default true,kind text default 'fixed');
    create table admin_memberships(user_id uuid primary key);
    create table checkout_orders(id uuid primary key,user_id uuid,status text default 'pending',amount_total int,currency text default 'usd',livemode bool default true,created_at timestamptz default now(),paid_at timestamptz,payment_in_progress bool default false,stripe_session_id text,expires_at timestamptz,payment_last_seen_at timestamptz);
    create table checkout_order_items(order_id uuid references checkout_orders,plan_id text,quantity int,unit_amount int,stripe_price_id text,primary key(order_id,plan_id));
    create table esim_fulfillments(id uuid primary key,order_id uuid,plan_id text,unit_index int,state text,provider_order_no text,provider_esim_id text,iccid text,smdp_address text,activation_code text,email_id text,sent_at timestamptz,qa_authorized bool default false);
    create table operational_email_events(id text primary key,email_id uuid,kind text,occurred_at timestamptz);
    create table refund_requests(id uuid primary key,order_id uuid,state text,amount int,currency text);
    create table refund_units(request_id uuid,unit_id uuid,amount int,active bool default true,held bool default true);
  `);
  for (const name of [
    "20261026000900_currency_rates.sql",
    "20261026001000_checkout_currency_snapshots.sql",
  ])
    await db.exec(
      readFileSync(
        new URL("../supabase/migrations/" + name, import.meta.url),
        "utf8",
      ),
    );
  await db.exec(readFileSync(migration, "utf8"));
  const user = randomUUID();
  await db.query("insert into auth.users values($1)", [user]);
  await db.query("insert into admin_memberships values($1)", [user]);
  await db.exec(
    "insert into catalog_plans(id,retail_price_cents)values('plan',1000)",
  );
  return { db, user };
}
const wallet = async (db, user) =>
  (await db.query("select simcoins_wallet($1) w", [user])).rows[0].w;
async function enable(db) {
  await db.exec(
    "update simcoins_program_settings set enabled=true,earn_enabled=true,redeem_enabled=true,admin_enabled=true,release_delay_seconds=0;insert into simcoins_private_costs(plan_id,wholesale_unit_units,observed_at)values('plan',10000,now());insert into simcoins_product_eligibility(plan_id,earn_enabled,redeem_enabled)values('plan',true,true)",
  );
}
async function explorer(db, user) {
  const a = (await db.query("select simcoins_account($1) a", [user])).rows[0].a;
  await db.query(
    "insert into simcoins_transactions(account_id,source_key,kind,bucket,coin_delta,spend_delta_cents)values($1,'prior-purchase','EARN','pending',0,1)",
    [a],
  );
}
function snapshot(redeem = 0) {
  const net = 1000 - redeem,
    earn = Math.floor((net * 300) / 10000);
  return {
    version: 1,
    policyVersion: 1,
    levelId: "explorer",
    rateBps: 300,
    currency: "USD",
    fxRate: "10000000000",
    currencyDecimals: 2,
    promoCents: 0,
    taxCents: 0,
    grossCents: 1000,
    netCents: net,
    redeemedCoins: redeem,
    earnedCoins: earn,
    eligibleSpendCents: net,
    lines: [
      {
        planId: "plan",
        quantity: 1,
        grossUnitCents: 1000,
        netUnitCents: net,
        redeemUnitCoins: redeem,
        earnedCoins: earn,
        eligibleSpendCents: net,
        wholesaleUnitUnits: 10000,
        earnEligible: true,
        redeemEligible: true,
        reason: "eligible",
      },
    ],
    units: [
      {
        planId: "plan",
        unitIndex: 1,
        grossCents: 1000,
        netCents: net,
        paidCents: net,
        redeemedCoins: redeem,
        earnedCoins: earn,
        eligibleSpendCents: net,
        wholesaleUnits: 10000,
        fixedFeeUnits: 3000,
        taxCents: 0,
        promotionCents: 0,
        earnEligible: true,
        reason: "eligible",
      },
    ],
  };
}
async function order(db, user, coins = 0) {
  const id = randomUUID();
  await db.query(
    "insert into checkout_orders(id,user_id,amount_total)values($1,$2,1000)",
    [id, user],
  );
  await db.query(
    "insert into checkout_order_items values($1,'plan',1,1000,'price_plan',null,null,null)",
    [id],
  );
  const quote = (
    await db.query("select simcoins_create_quote($1,$2,'USD',null,$3) q", [
      user,
      "a".repeat(64),
      snapshot(coins),
    ])
  ).rows[0].q;
  await db.query("select simcoins_prepare_order($1,$2,$3)", [
    id,
    user,
    quote.id,
  ]);
  return id;
}
test("program defaults off; wallet is safe and ledger/config contracts exist", async () => {
  const { db, user } = await fixture();
  try {
    const w = await wallet(db, user);
    assert.equal(w.availableCoins, 0);
    assert.equal(w.level.id, "traveler");
    assert.equal(w.nextLevel.thresholdCents, 1);
    await assert.rejects(
      db.query("select simcoins_create_quote($1,$2,'USD',null,$3)", [
        user,
        "a".repeat(64),
        snapshot(),
      ]),
      /simcoins_disabled/,
    );
    const settings = (await db.query("select * from simcoins_program_settings"))
      .rows[0];
    assert.equal(settings.enabled, false);
    assert.equal(settings.release_delay_seconds, 604800);
  } finally {
    await db.close();
  }
});
test("quote guards reject stale costs, unsafe amounts and unaudited browser access; settings audit is idempotent", async () => {
  const { db, user } = await fixture();
  try {
    await enable(db);
    await explorer(db, user);
    const quote = (s) =>
      db.query("select simcoins_create_quote($1,$2,'USD',null,$3)", [
        user,
        "b".repeat(64),
        s,
      ]);
    await db.exec(
      "update simcoins_private_costs set observed_at=now()-interval '1 hour'",
    );
    await assert.rejects(quote(snapshot()), /simcoins_cost_unavailable/);
    await db.exec("update simcoins_private_costs set observed_at=now()");
    for (const change of [
      (s) => s.netCents++,
      (s) => s.units[0].fixedFeeUnits--,
      (s) => s.units[0].earnedCoins++,
      (s) => s.lines[0].grossUnitCents++,
    ]) {
      const s = snapshot();
      change(s);
      await assert.rejects(quote(s), /simcoins_/);
    }
    await db.exec(
      "update simcoins_private_costs set wholesale_unit_units=90000",
    );
    const unsafe = snapshot();
    unsafe.lines[0].wholesaleUnitUnits = 90000;
    unsafe.units[0].wholesaleUnits = 90000;
    await assert.rejects(
      quote(unsafe),
      /simcoins_invalid_units|simcoins_insufficient_margin/,
    );
    const request = randomUUID();
    await db.query(
      "select simcoins_admin_configure($1,'settings',$2,'Local policy review',$3)",
      [user, { release_delay_seconds: 60 }, request],
    );
    await db.query(
      "select simcoins_admin_configure($1,'settings',$2,'Local policy review',$3)",
      [user, { release_delay_seconds: 60 }, request],
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from simcoins_audit_logs where request_id=$1",
          [request],
        )
      ).rows[0].n,
      1,
    );
    await assert.rejects(
      db.query(
        "select simcoins_admin_configure($1,'settings',$2,'Local policy review',$3)",
        [user, { release_delay_seconds: 120 }, request],
      ),
      /simcoins_request_conflict/,
    );
    await assert.rejects(
      db.query(
        "select simcoins_admin_configure($1,'settings',$2,'Unsafe margin policy',$3)",
        [user, { min_contribution_bps: 1999 }, randomUUID()],
      ),
      /check constraint/,
    );
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("select simcoins_wallet($1)", [user]),
      /permission denied/,
    );
    await assert.rejects(
      db.exec("select * from simcoins_private_costs"),
      /permission denied/,
    );
    await db.exec("reset role");
  } finally {
    await db.close();
  }
});
test("two already quoted checkouts cannot both reserve; discounted FX payment snapshot keeps original USD gross", async () => {
  const { db, user } = await fixture();
  try {
    await enable(db);
    await explorer(db, user);
    await db.query(
      "select simcoins_admin_adjust($1,$1,50,'Concurrent reserve fixture',$2)",
      [user, randomUUID()],
    );
    const ids = [randomUUID(), randomUUID()],
      quotes = [];
    for (const id of ids) {
      await db.query(
        "insert into checkout_orders(id,user_id,amount_total)values($1,$2,1000)",
        [id, user],
      );
      await db.query(
        "insert into checkout_order_items values($1,'plan',1,1000,'price_plan',null,null,null)",
        [id],
      );
      quotes.push(
        (
          await db.query("select simcoins_create_quote($1,$2,'USD',null,$3)q", [
            user,
            "d".repeat(64),
            snapshot(50),
          ])
        ).rows[0].q.id,
      );
    }
    const outcomes = await Promise.allSettled(
      ids.map((id, i) =>
        db.query("select simcoins_prepare_order($1,$2,$3)", [
          id,
          user,
          quotes[i],
        ]),
      ),
    );
    assert.equal(outcomes.filter((x) => x.status === "fulfilled").length, 1);
    assert.match(
      String(outcomes.find((x) => x.status === "rejected").reason),
      /insufficient_coins/,
    );
    const id = ids[outcomes.findIndex((x) => x.status === "fulfilled")];
    const p = (
      await db.query("select simcoins_prepare_payment($1,'USD',null,950)o", [
        id,
      ])
    ).rows[0].o;
    assert.equal(p.amount_total, 1000);
    assert.equal(p.payment_total, 950);
    await assert.rejects(
      db.query("select simcoins_prepare_payment($1,'USD',null,1000)", [id]),
      /attempt_conflict/,
    );
    await assert.rejects(
      db.query(
        "update simcoins_order_snapshots set snapshot=$2 where order_id=$1",
        [id, snapshot()],
      ),
      /immutable/,
    );
    await assert.rejects(
      db.query("update checkout_orders set payment_total=1000 where id=$1", [
        id,
      ]),
      /immutable_payment_snapshot/,
    );
    const fx = randomUUID(),
      jpy = randomUUID();
    await db.query(
      "insert into fx_snapshots(id,provider_ref,rates,sampled_at)values($1,'fxq_local',$2,now())",
      [fx, { USD: "10000000000", JPY: "1500000000000" }],
    );
    await db.query(
      "insert into checkout_orders(id,user_id,amount_total)values($1,$2,1000)",
      [jpy, user],
    );
    await db.query(
      "insert into checkout_order_items values($1,'plan',1,1000,'price_plan',null,null,null)",
      [jpy],
    );
    const s = snapshot();
    s.currency = "JPY";
    s.fxRate = "1500000000000";
    s.currencyDecimals = 0;
    const q = (
      await db.query("select simcoins_create_quote($1,$2,'JPY',$3,$4)q", [
        user,
        "e".repeat(64),
        fx,
        s,
      ])
    ).rows[0].q;
    await db.query("select simcoins_prepare_order($1,$2,$3)", [
      jpy,
      user,
      q.id,
    ]);
    const j = (
      await db.query("select simcoins_prepare_payment($1,'JPY',$2,1500)o", [
        jpy,
        fx,
      ])
    ).rows[0].o;
    assert.equal(j.payment_total, 1500);
    assert.equal(j.amount_total, 1000);
  } finally {
    await db.close();
  }
});
test("SQL accepts the real integer engine snapshots, expanded quantities and deterministic fee allocation", async () => {
  const { db, user } = await fixture();
  try {
    await enable(db);
    await explorer(db, user);
    await db.query(
      "select simcoins_admin_adjust($1,$1,1000,'Engine integration fixture',$2)",
      [user, randomUUID()],
    );
    await db.exec(
      "insert into catalog_plans(id,retail_price_cents)values('other',1234);insert into simcoins_private_costs(plan_id,wholesale_unit_units,observed_at)values('other',20000,now());insert into simcoins_product_eligibility(plan_id,earn_enabled,redeem_enabled)values('other',true,true)",
    );
    for (const quantity of [1, 2, 3, 7, 10]) {
      const s = buildSimcoinsQuote({
        lines: [
          {
            planId: "plan",
            quantity,
            grossUnitCents: 1000,
            wholesaleUnitUnits: 10000,
            costObservedAt: new Date().toISOString(),
            earnEnabled: true,
            redeemEnabled: true,
          },
          {
            planId: "other",
            quantity: 1,
            grossUnitCents: 1234,
            wholesaleUnitUnits: 20000,
            costObservedAt: new Date().toISOString(),
            earnEnabled: true,
            redeemEnabled: true,
          },
        ],
        currency: "USD",
        availableCoins: 1000,
        requestedCoins: 1000,
        eligibleSpendCents: 1,
      });
      await db.query("select simcoins_create_quote($1,$2,'USD',null,$3)", [
        user,
        "f".repeat(64),
        s,
      ]);
    }
    const fx = randomUUID(),
      fxRate = "1453210000000";
    await db.query(
      "insert into fx_snapshots(id,provider_ref,rates,sampled_at)values($1,'fxq_rounding',$2,now())",
      [fx, { USD: "10000000000", JPY: fxRate }],
    );
    const j = buildSimcoinsQuote({
      lines: [
        {
          planId: "plan",
          quantity: 1,
          grossUnitCents: 1000,
          wholesaleUnitUnits: 10000,
          costObservedAt: new Date().toISOString(),
          earnEnabled: true,
          redeemEnabled: true,
        },
      ],
      currency: "JPY",
      fxRate,
      currencyDecimals: 0,
      availableCoins: 1000,
      requestedCoins: 0,
      eligibleSpendCents: 1,
    });
    assert.equal(j.units[0].paidCents, 999);
    assert.equal(j.eligibleSpendCents, 999);
    await db.query("select simcoins_create_quote($1,$2,'JPY',$3,$4)", [
      user,
      "f".repeat(64),
      fx,
      j,
    ]);
    const forged = structuredClone(j);
    forged.units[0].paidCents = 1000;
    await assert.rejects(
      db.query("select simcoins_create_quote($1,$2,'JPY',$3,$4)", [
        user,
        "f".repeat(64),
        fx,
        forged,
      ]),
      /simcoins_invalid_units/,
    );
  } finally {
    await db.close();
  }
});
test("cost refresh is enabled-only, leased once and remains rate limited after release", async () => {
  const { db } = await fixture();
  try {
    assert.equal(
      (await db.query("select simcoins_claim_cost_refresh() t")).rows[0].t,
      null,
    );
    await enable(db);
    const token = (await db.query("select simcoins_claim_cost_refresh() t"))
      .rows[0].t;
    assert.ok(token);
    assert.equal(
      (await db.query("select simcoins_claim_cost_refresh() t")).rows[0].t,
      null,
    );
    await db.query("select simcoins_release_cost_refresh($1)", [randomUUID()]);
    assert.equal(
      (await db.query("select lease_token from simcoins_cost_refresh")).rows[0]
        .lease_token,
      token,
    );
    await db.query("select simcoins_release_cost_refresh($1)", [token]);
    assert.equal(
      (await db.query("select simcoins_claim_cost_refresh() t")).rows[0].t,
      null,
    );
  } finally {
    await db.close();
  }
});
test("first eligible zero-rate purchase unlocks Explorer only for future purchases and full refund rolls tier back", async () => {
  const { db, user } = await fixture();
  try {
    await enable(db);
    const s = snapshot();
    s.levelId = "traveler";
    s.rateBps = 0;
    s.earnedCoins = 0;
    s.lines[0].earnedCoins = 0;
    s.units[0].earnedCoins = 0;
    const id = randomUUID(),
      unit = randomUUID(),
      refund = randomUUID();
    await db.query(
      "insert into checkout_orders(id,user_id,amount_total)values($1,$2,1000)",
      [id, user],
    );
    await db.query(
      "insert into checkout_order_items values($1,'plan',1,1000,'price_plan',null,null,null)",
      [id],
    );
    const q = (
      await db.query("select simcoins_create_quote($1,$2,'USD',null,$3)q", [
        user,
        "c".repeat(64),
        s,
      ])
    ).rows[0].q;
    await db.query("select simcoins_prepare_order($1,$2,$3)", [id, user, q.id]);
    await db.query("update checkout_orders set status='paid'where id=$1", [id]);
    let w = await wallet(db, user);
    assert.equal(w.level.id, "explorer");
    assert.equal(w.pendingCoins, 0);
    assert.equal(w.eligibleSpendCents, 1000);
    await db.query(
      "insert into esim_fulfillments(id,order_id,plan_id,unit_index,state)values($1,$2,'plan',1,'queued')",
      [unit, id],
    );
    await db.query(
      "insert into refund_requests values($1,$2,'pending',1000,'usd')",
      [refund, id],
    );
    await db.query(
      "insert into refund_units(request_id,unit_id,amount)values($1,$2,1000)",
      [refund, unit],
    );
    await db.query("update refund_requests set state='succeeded'where id=$1", [
      refund,
    ]);
    w = await wallet(db, user);
    assert.equal(w.level.id, "traveler");
    assert.equal(w.eligibleSpendCents, 0);
  } finally {
    await db.close();
  }
});
test("reserve mutex prevents double spend; paid/delivery/refund are idempotent and debt is auditable", async () => {
  const { db, user } = await fixture();
  try {
    await enable(db);
    await explorer(db, user);
    await db.query(
      "select simcoins_admin_adjust($1,$1,50,'Local test grant',$2)",
      [user, randomUUID()],
    );
    const id = await order(db, user, 50);
    assert.equal((await wallet(db, user)).reservedCoins, 50);
    await assert.rejects(order(db, user, 50), /insufficient_coins/);
    await db.query(
      "update checkout_orders set status='paid',paid_at=now()where id=$1",
      [id],
    );
    await db.query("select simcoins_reconcile_order($1)", [id]);
    let w = await wallet(db, user);
    assert.equal(w.pendingCoins, 28);
    assert.equal(w.reservedCoins, 0);
    assert.equal(w.eligibleSpendCents, 951);
    assert.equal(
      (await db.query("select simcoins_release_due(10) n")).rows[0].n,
      0,
    );
    const unit = randomUUID(),
      email = randomUUID();
    await db.query(
      "insert into esim_fulfillments values($1,$2,'plan',1,'sent','provider','profile','123','smdp','code',$3,now(),false)",
      [unit, id, email],
    );
    assert.equal(
      (await db.query("select simcoins_release_due(10) n")).rows[0].n,
      0,
      "email API acceptance alone is not delivery",
    );
    await db.query(
      "insert into operational_email_events values('evt',$1,'email.delivered',now())",
      [email],
    );
    assert.ok(
      (await wallet(db, user)).pending[0].releaseAt,
      "verified delivery exposes the expected availability date",
    );
    await db.exec(
      "update simcoins_program_settings set enabled=false,earn_enabled=false",
    );
    await db.query("select simcoins_release_due(10)");
    await db.query("select simcoins_release_due(10)");
    assert.equal((await wallet(db, user)).availableCoins, 28);
    await db.query(
      "select simcoins_admin_adjust($1,$1,-28,'Local spent reward simulation',$2)",
      [user, randomUUID()],
    );
    const refund = randomUUID();
    await db.query(
      "insert into refund_requests values($1,$2,'pending',950,'usd')",
      [refund, id],
    );
    await db.query(
      "insert into refund_units(request_id,unit_id,amount)values($1,$2,950)",
      [refund, unit],
    );
    await db.query("update refund_requests set state='succeeded'where id=$1", [
      refund,
    ]);
    await db.query("select simcoins_refund_order($1)", [refund]);
    w = await wallet(db, user);
    assert.equal(w.availableCoins, 22);
    assert.equal(w.pendingCoins, 0);
    assert.equal(w.eligibleSpendCents, 1);
    await assert.rejects(
      db.exec("update simcoins_transactions set coin_delta=999"),
      /immutable/,
    );
  } finally {
    await db.close();
  }
});
test("browser leave cannot release and authoritative expiry can; late payment debits safely", async () => {
  const { db, user } = await fixture();
  try {
    await enable(db);
    await explorer(db, user);
    await db.query("select simcoins_admin_adjust($1,$1,50,'Test grant',$2)", [
      user,
      randomUUID(),
    ]);
    const id = await order(db, user, 50);
    await db.query("select simcoins_reconcile_order($1)", [id]);
    assert.equal((await wallet(db, user)).reservedCoins, 50);
    await db.query(
      "update checkout_orders set status='expired',payment_in_progress=true where id=$1",
      [id],
    );
    assert.equal((await wallet(db, user)).reservedCoins, 50);
    await db.query(
      "update checkout_orders set payment_in_progress=false where id=$1",
      [id],
    );
    assert.equal((await wallet(db, user)).availableCoins, 50);
    await db.query(
      "select simcoins_admin_adjust($1,$1,-50,'Spend after release',$2)",
      [user, randomUUID()],
    );
    await db.query("update checkout_orders set status='paid'where id=$1", [id]);
    assert.equal((await wallet(db, user)).debtCoins, 50);
  } finally {
    await db.close();
  }
});
test("cumulative partial refunds use original allocations, do not round twice, and restore promotional coins once", async () => {
  const { db, user } = await fixture();
  try {
    await enable(db);
    await explorer(db, user);
    await db.query(
      "select simcoins_admin_adjust($1,$1,50,'Partial refund fixture',$2)",
      [user, randomUUID()],
    );
    const id = await order(db, user, 50),
      unit = randomUUID();
    await db.query("select simcoins_prepare_payment($1,'USD',null,950)", [id]);
    await db.query("update checkout_orders set status='paid'where id=$1", [id]);
    await db.query(
      "insert into esim_fulfillments(id,order_id,plan_id,unit_index,state)values($1,$2,'plan',1,'queued')",
      [unit, id],
    );
    const refunds = [randomUUID(), randomUUID()];
    for (let i = 0; i < 2; i++) {
      await db.query(
        "insert into refund_requests values($1,$2,'pending',475,'usd')",
        [refunds[i], id],
      );
      await db.query(
        "insert into refund_units(request_id,unit_id,amount)values($1,$2,475)",
        [refunds[i], unit],
      );
      await db.query(
        "update refund_requests set state='succeeded'where id=$1",
        [refunds[i]],
      );
      await db.query("select simcoins_refund_order($1)", [refunds[i]]);
      let w = await wallet(db, user);
      assert.equal(w.availableCoins, i === 0 ? 25 : 50);
      assert.equal(w.pendingCoins, i === 0 ? 14 : 0);
      assert.equal(w.eligibleSpendCents, 1 + 475 * (1 - i));
      if (i === 0) {
        const email = randomUUID();
        await db.query(
          "update esim_fulfillments set state='sent',provider_order_no='p',provider_esim_id='e',iccid='123',smdp_address='s',activation_code='a',email_id=$2,sent_at=now()where id=$1",
          [unit, email],
        );
        await db.query(
          "insert into operational_email_events values('partial_delivery',$1,'email.delivered',now())",
          [email],
        );
        await db.query("select simcoins_release_due(10)");
        w = await wallet(db, user);
        assert.equal(w.availableCoins, 39);
        assert.equal(w.pendingCoins, 0);
      }
    }
  } finally {
    await db.close();
  }
});

test("excluded offers retain a bounded immutable reason without posting financial rewards", async () => {
  const { db, user } = await fixture();
  try {
    await enable(db);
    const snapshot = {
      reason: "unverified_cost",
      policyVersion: 1,
      currency: "USD",
      lines: [],
      contributionUnits: 0,
    };
    for (let i = 0; i < 2; i++)
      await db.query("select simcoins_record_exclusion($1,$2,$3)", [
        user,
        "a".repeat(64),
        snapshot,
      ]);
    const rows = (
      await db.query(
        "select reason,after_value from simcoins_audit_logs where action='quote_excluded'",
      )
    ).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].reason, "unverified_cost");
    assert.equal((await wallet(db, user)).availableCoins, 0);
    await assert.rejects(
      db.exec("delete from simcoins_audit_logs"),
      /immutable/,
    );
  } finally {
    await db.close();
  }
});
