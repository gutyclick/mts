import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
export async function fixture() {
  const db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as 'select null::uuid';`,
  );
  for (const name of [
    "20261024000100_catalog.sql",
    "20261024000200_customer_accounts.sql",
    "20261024000300_provider_bindings.sql",
    "20261025000100_retail_prices.sql",
    "20261025000300_test_checkout.sql",
    "20261025000400_checkout_recipient_and_elements.sql",
    "20261025000500_payment_holds.sql",
    "20261025000900_esim_fulfillment.sql",
    "20261026000300_checkout_legal_acceptance.sql",
  ])
    await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
  await db.exec(`alter table checkout_orders drop constraint checkout_orders_livemode_check;
  alter table checkout_orders add column payment_total int,add column payment_currency text;
  insert into catalog_destinations(slug,name,code,type,image,artwork_kind,is_published) values('panama','{"es":"Panamá","en":"Panama"}','PA','country','/flags/pa.svg','flag',true);
  insert into catalog_plans(id,destination_slug,name,allowance,data_gb,days,coverage_code,is_published,retail_price_cents) values('PA_1_7','panama','Panama 1GB 7Days','1GB',1,7,'PA',true,400);
  insert into provider_package_bindings(plan_id,provider_slug,package_code,volume_bytes,days) values('PA_1_7','PA_1_7','fixture',1073741824,7);`);
  await db.exec(
    readFileSync(
      "supabase/migrations/20261107000100_checkout_yappy.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "supabase/migrations/20261107000300_yappy_hold_consistency.sql",
      "utf8",
    ),
  );
  async function order({ live = true, terms = true } = {}) {
    const id = randomUUID();
    await db.query(
      `insert into checkout_orders(id,recipient_email,browser_hash,ip_hash,fingerprint,locale,amount_total,livemode,payment_total,payment_currency)values($1,'guest@example.invalid',$2,$2,$2,'es',800,$3,800,'USD')`,
      [id, "a".repeat(64), live],
    );
    await db.query(
      `insert into checkout_order_items(order_id,plan_id,destination_slug,destination_name,plan_name,data_gb,days,quantity,unit_amount,stripe_price_id)values($1,'PA_1_7','panama','{"es":"Panamá","en":"Panama"}','Panama 1GB 7Days',1,7,2,400,'price_fixture')`,
      [id],
    );
    if (terms)
      await db.query(
        `insert into checkout_legal_acceptances(order_id,version,locale)values($1,'2026-11-07-v1','es')`,
        [id],
      );
    return id;
  }
  const claim = (id, ref = "abcdef123456789", live = true) =>
    db.query(
      `select retail_yappy_claim($1,$2,800,'https://www.mytripsim.com',$3)`,
      [id, ref, live],
    );
  const settle = (
    ref,
    status,
    domain = "https://www.mytripsim.com",
    live = true,
  ) =>
    db.query("select retail_yappy_settle($1,$2,$3,$4) as state", [
      ref,
      status,
      domain,
      live,
    ]);
  return { db, order, claim, settle };
}
