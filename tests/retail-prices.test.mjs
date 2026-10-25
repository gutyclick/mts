import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { retailCents, projectRetailPrices } from "../src/lib/retail-prices.ts";
import { planVariant } from "../src/lib/plan-variants.ts";
import { cartTotal } from "../src/lib/cart.ts";

test("only exact final selling prices are imported; costs and margins never enter the public projection", () => {
  const plan = { id: "test", dataGb: 1, days: 7 };
  const row = {
    "ID del plan": "test",
    "Datos (GB)": "1",
    "Duración (días)": "7",
    "Precio final (USD)": "9.99",
    "Costo proveedor (USD)": "private-cost",
    "Ganancia bruta (USD)": "private-margin",
  };
  assert.deepEqual(projectRetailPrices([row], [plan]), { test: 999 });
  for (const value of ["", "0", "-1", "9.999", "1e3", "NaN"])
    assert.throws(() => retailCents(value));
  assert.equal(retailCents("10.1"), 1010);
  assert.throws(() => projectRetailPrices([row, row], [plan]));
  assert.throws(() =>
    projectRetailPrices([{ ...row, "Duración (días)": "30" }], [plan]),
  );
  assert.throws(() => projectRetailPrices([], [plan]));
  assert.equal(
    cartTotal({
      items: [
        { retailPriceCents: 199, quantity: 3 },
        { retailPriceCents: 1000, quantity: 2 },
      ],
      unavailable: [],
    }),
    2597,
  );
  assert.equal(cartTotal({ items: [{ quantity: 1 }], unavailable: [] }), null);
});
test("variants retain supplier labels and explain breakout IP without inventing numbered options", () => {
  assert.equal(
    planVariant({ id: "US_1_7_usip", name: "US" }, "es").label,
    "USIP",
  );
  assert.match(
    planVariant({ id: "US_1_7_usip", name: "US" }, "es").description,
    /IP de Estados Unidos/,
  );
  for (const [suffix, label] of [
    ["nonhkip", "nonhkip"],
    ["Premium", "Premium"],
    ["IIJ", "IIJ"],
    ["myip", "MYIP"],
    ["usip_FIFA", "USIP · FIFA"],
  ])
    assert.equal(
      planVariant({ id: `fixture_1_7_${suffix}`, name: "test" }, "en").label,
      label,
    );
  assert.equal(
    planVariant({ id: "IE_500M_3", name: "Ireland 500MB 3Days" }, "es").label,
    "Estándar",
  );
});
test("retail writes are private, validated and atomic while final prices remain publicly readable", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create table public.catalog_plans(id text primary key,kind text);insert into public.catalog_plans values('test','fixed');grant select on public.catalog_plans to anon,authenticated,service_role;",
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/20261025000100_retail_prices.sql",
        "utf8",
      ),
    );
    await db.exec("set role authenticated");
    await assert.rejects(
      db.query("select public.apply_retail_prices($1::jsonb)", [
        JSON.stringify([{ plan_id: "test", amount_cents: 999 }]),
      ]),
      /permission denied/,
    );
    await assert.rejects(
      db.query(
        "update public.catalog_plans set retail_price_cents=1 where id='test'",
      ),
      /permission denied/,
    );
    await db.exec("reset role;set role service_role");
    const query = "select public.apply_retail_prices($1::jsonb) as count";
    assert.equal(
      (
        await db.query(query, [
          JSON.stringify([{ plan_id: "test", amount_cents: 999 }]),
        ])
      ).rows[0].count,
      1,
    );
    await assert.rejects(
      db.query(query, [
        JSON.stringify([
          { plan_id: "test", amount_cents: 1 },
          { plan_id: "missing", amount_cents: 999 },
        ]),
      ]),
      /identity/,
    );
    await assert.rejects(
      db.query(query, [
        JSON.stringify([{ plan_id: "test", amount_cents: 100, cost: 1 }]),
      ]),
      /fields/,
    );
    await db.exec("reset role;set role anon");
    assert.equal(
      (
        await db.query(
          "select retail_price_cents from public.catalog_plans where id='test'",
        )
      ).rows[0].retail_price_cents,
      999,
    );
  } finally {
    await db.close();
  }
});
