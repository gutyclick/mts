import test from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
test("FX snapshots are immutable, service-only, bounded and refreshed under one lease", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;",
    );
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261026000900_currency_rates.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const rates = Object.fromEntries(
      [
        "USD",
        "EUR",
        "GBP",
        "CAD",
        "CHF",
        "AUD",
        "MXN",
        "COP",
        "ARS",
        "CLP",
        "DOP",
        "UYU",
        "BRL",
        "KRW",
        "CNY",
        "JPY",
        "PEN",
        "DKK",
      ].map((c) => [c, "10000000000"]),
    );
    const token = (await db.query("select fx_claim_refresh() as t")).rows[0].t;
    assert.ok(token);
    assert.equal(
      (await db.query("select fx_claim_refresh() as t")).rows[0].t,
      null,
    );
    await assert.rejects(
      db.query("select fx_store_snapshot($1,$2,$3,$4)", [
        token,
        "fxq_fixture",
        new Date(),
        { ...rates, USD: "9" },
      ]),
      /invalid_rates/,
    );
    const id = (
      await db.query("select fx_store_snapshot($1,$2,$3,$4) as id", [
        token,
        "fxq_fixture",
        new Date(),
        rates,
      ])
    ).rows[0].id;
    assert.ok(id);
    assert.equal(
      (await db.query("select fx_claim_refresh() as t")).rows[0].t,
      null,
    );
    assert.equal(
      (
        await db.query(
          "select fx_convert_minor(349,'JPY','1502500000000') as n",
        )
      ).rows[0].n,
      524,
    );
    assert.equal(
      (await db.query("select fx_convert_minor(1,'JPY','1500000000000') as n"))
        .rows[0].n,
      2,
    );
    await assert.rejects(
      db.query("select fx_convert_minor(100,'BTC','10000000000')"),
      /invalid_currency/,
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec("set role " + role);
      await assert.rejects(
        db.query("select * from fx_snapshots"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select fx_claim_refresh()"),
        /permission denied/,
      );
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    await assert.rejects(
      db.query("update fx_snapshots set rates=$1 where id=$2", [rates, id]),
      /permission denied/,
    );
    await db.exec("reset role");
  } finally {
    await db.close();
  }
});
