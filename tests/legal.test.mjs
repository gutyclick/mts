import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { deliveryEmail } from "../src/lib/fulfillment/email.ts";
import { legalVersion } from "../src/lib/legal-version.ts";
const content = JSON.parse(
  readFileSync(new URL("../src/content/legal.json", import.meta.url), "utf8"),
);
test("legal documents cover all locales without unfinished clauses or blanket refund waivers", () => {
  for (const locale of ["es", "en"])
    for (const key of ["terms", "privacy", "refunds", "cookies"]) {
      const doc = content[locale][key];
      assert.ok(doc.title && doc.sections.length >= 5);
      assert.equal(
        new Set(doc.sections.map((s) => s.id)).size,
        doc.sections.length,
      );
      const text = JSON.stringify(doc);
      assert.match(text, /hello@mytripsim.com/);
      assert.doesNotMatch(
        text,
        /\b(?:Borrador|Pendiente de|Antes de publicar|Decisión comercial pendiente|no refunds under any circumstances)/i,
      );
    }
  assert.match(JSON.stringify(content.es.terms), /Nuevo México/);
  assert.match(JSON.stringify(content.en.terms), /New Mexico/);
  assert.match(JSON.stringify(content.es.refunds), /revisan individualmente/);
  assert.match(JSON.stringify(content.en.refunds), /reviewed individually/);
});
test("legal acceptance is versioned, idempotent, private and immutable without backfilling orders", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role bypassrls;create table public.checkout_orders(id uuid primary key);",
    );
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261026000300_checkout_legal_acceptance.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const id = randomUUID();
    await db.query("insert into checkout_orders values($1)", [id]);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from checkout_legal_acceptances",
        )
      ).rows[0].n,
      0,
    );
    await db.exec("set role service_role");
    const insert = () =>
      db.query(
        "insert into checkout_legal_acceptances(order_id,version,locale) values($1,$2,'es') on conflict do nothing returning accepted_at",
        [id, legalVersion],
      );
    assert.equal((await insert()).rows.length, 1);
    assert.equal((await insert()).rows.length, 0);
    assert.equal(
      (
        await db.query(
          "select count(*)::int as n from checkout_legal_acceptances",
        )
      ).rows[0].n,
      1,
    );
    await db.exec("reset role");
    await assert.rejects(
      db.query("update checkout_legal_acceptances set locale='en'"),
      /legal_acceptance_immutable/,
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec("set role " + role);
      await assert.rejects(
        db.query("select * from checkout_legal_acceptances"),
        /permission denied/,
      );
      await assert.rejects(insert(), /permission denied/);
      await db.exec("reset role");
    }
    await assert.rejects(
      db.query(
        "insert into checkout_legal_acceptances values($1,'bad','es',now())",
        [id],
      ),
      /check constraint/,
    );
  } finally {
    await db.close();
  }
});
test("recipient delivery includes the seller, privacy notice and support contact in HTML and plain text", () => {
  for (const locale of ["es", "en"]) {
    const email = deliveryEmail({
      locale,
      name: "Example",
      dataGb: 1,
      days: 7,
      reference: "fixture",
      smdpAddress: "example.invalid",
      activationCode: "fixture",
      link: "https://www.mytripsim.com/" + locale,
      qrContentId: "fixture",
    });
    for (const value of [email.html, email.text]) {
      assert.match(value, /YellowCat Enterprises LLC/);
      assert.match(value, /hello@mytripsim.com/);
      assert.match(value, /1209 Mountain Road/);
      assert.ok(
        value.includes(locale === "es" ? "/es/privacidad" : "/en/privacy"),
      );
    }
  }
});
