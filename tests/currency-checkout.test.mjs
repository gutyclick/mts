import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
test("local checkout snapshots freeze exact per-unit amounts, reject tampering and keep canonical USD intact", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create table checkout_orders(id uuid primary key,status text default 'pending',amount_total integer,currency text default 'usd',livemode boolean default true,stripe_session_id text,expires_at timestamptz,payment_last_seen_at timestamptz);create table checkout_order_items(order_id uuid references checkout_orders(id),plan_id text,quantity integer,unit_amount integer,stripe_price_id text,primary key(order_id,plan_id));",
    );
    for (const name of [
      "20261026000900_currency_rates.sql",
      "20261026001000_checkout_currency_snapshots.sql",
      "20261026001200_currency_catalog_product_ids.sql",
    ])
      await db.exec(
        readFileSync(
          new URL("../supabase/migrations/" + name, import.meta.url),
          "utf8",
        ),
      );
    const order = randomUUID(),
      usd = randomUUID(),
      quote = randomUUID(),
      rates = { USD: "10000000000", JPY: "1500000000000" };
    await db.query(
      "insert into fx_snapshots(id,provider_ref,rates,sampled_at)values($1,'fxq_fixture',$2,now())",
      [quote, rates],
    );
    for (const id of [order, usd]) {
      await db.query(
        "insert into checkout_orders(id,amount_total)values($1,299)",
        [id],
      );
      await db.query(
        "insert into checkout_order_items values($1,'plan',1,299,'price_base')",
        [id],
      );
    }
    await assert.rejects(
      db.query("select prepare_checkout_payment($1,$2,$3,$4)", [
        order,
        "JPY",
        quote,
        450,
      ]),
      /price_changed/,
    );
    let r = (
      await db.query("select prepare_checkout_payment($1,$2,$3,$4) as o", [
        order,
        "JPY",
        quote,
        449,
      ])
    ).rows[0].o;
    assert.equal(r.amount_total, 299);
    assert.equal(r.payment_total, 449);
    assert.equal(r.payment_currency, "JPY");
    await db.query(
      "update fx_snapshots set expires_at=now()-interval '1 day' where id=$1",
      [quote],
    );
    r = (
      await db.query("select prepare_checkout_payment($1,$2,$3,$4) as o", [
        order,
        "JPY",
        quote,
        449,
      ])
    ).rows[0].o;
    assert.equal(r.payment_total, 449, "retries never reprice");
    await assert.rejects(
      db.query("select prepare_checkout_payment($1,$2,$3,$4)", [
        order,
        "EUR",
        quote,
        449,
      ]),
      /attempt_conflict/,
    );
    await assert.rejects(
      db.query("select bind_checkout_payment($1,$2,$3,$4,$5)", [
        order,
        "cs_live_fixture",
        [
          {
            planId: "plan",
            priceId: "price_local",
            unitAmount: 450,
            quantity: 1,
            productId: "mts_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
          },
        ],
        new Date(Date.now() + 3600000),
        false,
      ]),
      /payment_mismatch/,
    );
    await db.query("select bind_checkout_payment($1,$2,$3,$4,$5)", [
      order,
      "cs_live_fixture",
      [
        {
          planId: "plan",
          priceId: "price_local",
          unitAmount: 449,
          quantity: 1,
          productId: "mts_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        },
      ],
      new Date(Date.now() + 3600000),
      false,
    ]);
    assert.equal(
      (
        await db.query(
          "select payment_stripe_price_id from checkout_order_items where order_id=$1",
          [order],
        )
      ).rows[0].payment_stripe_price_id,
      "price_local",
    );
    r = (
      await db.query(
        "select prepare_checkout_payment($1,'USD',null,299) as o",
        [usd],
      )
    ).rows[0].o;
    assert.equal(r.payment_total, 299);
    assert.equal(r.payment_currency, "USD");
    const expired = randomUUID();
    await db.query(
      "insert into checkout_orders(id,amount_total)values($1,299)",
      [expired],
    );
    await db.query(
      "insert into checkout_order_items values($1,'plan',1,299,'price_base')",
      [expired],
    );
    await assert.rejects(
      db.query("select prepare_checkout_payment($1,$2,$3,$4)", [
        expired,
        "JPY",
        quote,
        449,
      ]),
      /quote_expired/,
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec("set role " + role);
      await assert.rejects(
        db.query("select prepare_checkout_payment($1,'USD',null,299)", [usd]),
        /permission denied/,
      );
      await db.exec("reset role");
    }
  } finally {
    await db.close();
  }
});
