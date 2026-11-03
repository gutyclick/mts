import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { catalogMerchandisingRequestSchema } from "../src/lib/admin/catalog-merchandising.ts";
const actor = "00000000-0000-4000-8000-000000000001";
const plan = {
  plan_id: "real-sku",
  visibility: "show",
  commercial_category: "essential",
  recommendation_eligible: true,
  incident_block: false,
  main_priority: 1,
};
test("governance request rejects prices, unknown fields, unverified or excessive modality sets", () => {
  assert.equal(
    catalogMerchandisingRequestSchema.safeParse({ entity: "plan", value: plan })
      .success,
    true,
  );
  assert.equal(
    catalogMerchandisingRequestSchema.safeParse({
      entity: "plan",
      value: { ...plan, retail_price_cents: 1 },
    }).success,
    false,
  );
  for (const approved_modalities of [
    ["standard", "premium", "iij", "usip"],
    ["standard", "standard"],
    ["daily"],
  ])
    assert.equal(
      catalogMerchandisingRequestSchema.safeParse({
        entity: "destination",
        value: {
          destination_slug: "panama",
          approved_modalities,
          approval_evidence: "Verified technical source",
        },
      }).success,
      false,
    );
});
test("private writes enforce admin, audit atomically, survive provider refresh and block only new commerce", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      `create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table public.admin_memberships(user_id uuid primary key);create table public.catalog_destinations(slug text primary key,is_published boolean);create table public.catalog_plans(id text primary key,is_published boolean,retail_price_cents int,name text,days int default 7);create table public.provider_package_bindings(plan_id text,provider_slug text,days int,is_available boolean,package_code text);alter table public.provider_package_bindings enable row level security;grant select on public.catalog_plans,public.catalog_destinations to anon,authenticated;create table public.checkout_order_items(order_id uuid,plan_id text);create function public.prepare_checkout_payment(uuid,text,uuid,integer)returns jsonb language sql as $$select '{}'::jsonb$$;create function public.coupon_prepare_payment(uuid,text,uuid,text,uuid,integer)returns jsonb language sql as $$select '{}'::jsonb$$;`,
    );
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261103000400_catalog_merchandising.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.query("insert into auth.users values($1);", [actor]);
    await db.query("insert into admin_memberships values($1)", [actor]);
    await db.exec(
      "insert into catalog_destinations values('panama',true);insert into catalog_plans values('real-sku',true,1234,'Original',7);insert into provider_package_bindings values('real-sku','real-sku',7,true,'PRIVATE_CODE');",
    );
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      assert.deepEqual(
        (await db.query("select * from catalog_available_plan_ids")).rows,
        [{ id: "real-sku" }],
      );
      await assert.rejects(
        db.query("select package_code from catalog_available_plan_ids"),
      );
      await assert.rejects(db.query("select * from provider_package_bindings"));
      await assert.rejects(
        db.query("select catalog_merchandising_save($1,$2,$3)", [
          actor,
          "plan",
          plan,
        ]),
      );
      await assert.rejects(
        db.exec(
          "insert into catalog_plan_merchandising(plan_id)values('real-sku')",
        ),
      );
      await db.exec("reset role");
    }
    await assert.rejects(
      db.query("select catalog_merchandising_save($1,$2,$3)", [
        "00000000-0000-4000-8000-000000000002",
        "plan",
        plan,
      ]),
    );
    await db.query("select catalog_merchandising_save($1,$2,$3)", [
      actor,
      "plan",
      plan,
    ]);
    await db.query("select catalog_merchandising_save($1,$2,$3)", [
      actor,
      "destination",
      {
        destination_slug: "panama",
        approved_modalities: ["standard", "iij"],
        approval_evidence: "PRIVATE_OPERATOR_NOTE",
      },
    ]);
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      assert.deepEqual(
        (
          await db.query(
            "select * from catalog_destination_merchandising_public",
          )
        ).rows,
        [
          {
            destination_slug: "panama",
            approved_modalities: ["standard", "iij"],
            approval_verified: true,
          },
        ],
      );
      await assert.rejects(
        db.query(
          "select approval_evidence from catalog_destination_merchandising",
        ),
      );
      await assert.rejects(
        db.query("select updated_by from catalog_plan_merchandising"),
      );
      assert.equal(
        (await db.query("select plan_id from catalog_plan_merchandising"))
          .rows[0].plan_id,
        "real-sku",
      );
      await db.exec("reset role");
    }
    await db.exec("update catalog_plans set name='Provider refreshed';");
    assert.equal(
      (
        await db.query(
          "select commercial_category from catalog_plan_merchandising",
        )
      ).rows[0].commercial_category,
      "essential",
    );
    assert.equal(
      (await db.query("select retail_price_cents from catalog_plans")).rows[0]
        .retail_price_cents,
      1234,
    );
    await db.query("insert into checkout_order_items values($1,$2)", [
      actor,
      "real-sku",
    ]);
    await db.query("select catalog_merchandising_save($1,$2,$3)", [
      actor,
      "plan",
      { ...plan, incident_block: true },
    ]);
    await assert.rejects(
      db.query("insert into checkout_order_items values($1,$2)", [
        actor,
        "real-sku",
      ]),
    );
    await db.exec("set role service_role");
    await assert.rejects(
      db.query("select prepare_checkout_payment($1,'USD',null,1234)", [actor]),
    );
    await assert.rejects(
      db.query(
        "select coupon_prepare_payment($1,'identity',null,'USD',null,1234)",
        [actor],
      ),
    );
    await assert.rejects(
      db.query(
        "select catalog_original_prepare_checkout_payment($1,'USD',null,1234)",
        [actor],
      ),
    );
    await db.exec("reset role");
    assert.equal(
      (await db.query("select count(*)::int n from checkout_order_items"))
        .rows[0].n,
      1,
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from catalog_merchandising_audit",
        )
      ).rows[0].n,
      3,
    );
    await assert.rejects(
      db.query("select catalog_merchandising_save($1,$2,$3)", [
        actor,
        "destination",
        {
          destination_slug: "panama",
          approved_modalities: ["standard", "premium", "iij", "usip"],
          approval_evidence: "Technical evidence",
        },
      ]),
    );
    assert.equal(
      (
        await db.query(
          "select count(*)::int n from catalog_merchandising_audit",
        )
      ).rows[0].n,
      3,
    );
  } finally {
    await db.close();
  }
});
