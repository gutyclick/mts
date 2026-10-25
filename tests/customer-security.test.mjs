import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { safeAccountNext, authPath } from "../src/lib/auth-routes.ts";
import { equivalentPath } from "../src/lib/i18n.ts";

test("account destinations reject external URLs and preserve only owned-area UUID links", () => {
  assert.equal(
    safeAccountNext("/es/compra?next=https://evil.example", "es"),
    "/es/compra",
  );
  assert.equal(safeAccountNext("/en/checkout", "en"), "/en/checkout");
  for (const value of [
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/es/mis-esim/../../evil",
    "/es/mis-esim?next=https://evil.example",
    "/es/mis-esim%0aLocation:evil",
  ])
    assert.equal(safeAccountNext(value, "es"), "/es/mis-esim");
  assert.equal(
    safeAccountNext(
      "/es/mis-esim?esim=11111111-1111-4111-8111-111111111111&next=evil",
      "es",
    ),
    "/es/mis-esim?esim=11111111-1111-4111-8111-111111111111",
  );
  assert.equal(
    equivalentPath("/es/recuperar-contrasena", "en"),
    authPath("en", "forgot"),
  );
});

test("customer tables isolate owners, deny client mutations and reject mismatched order ownership", async () => {
  const db = new PGlite();
  const a = "11111111-1111-4111-8111-111111111111",
    b = "22222222-2222-4222-8222-222222222222";
  const oa = "33333333-3333-4333-8333-333333333333",
    ob = "44444444-4444-4444-8444-444444444444";
  try {
    await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); grant usage on schema auth to authenticated;
   create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
   insert into auth.users values ('${a}'),('${b}');`);
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261024000200_customer_accounts.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await db.exec(`insert into customer_orders(id,user_id,status,destination_name,destination_slug,plan_id,plan_name,data_gb,days) values
   ('${oa}','${a}','completed','{"es":"Japón","en":"Japan"}','japan','JP_1','Japan 1GB',1,7),
   ('${ob}','${b}','completed','{"es":"Francia","en":"France"}','france','FR_1','France 1GB',1,7);
   insert into customer_esims(user_id,order_id,status,activation_code) values ('${a}','${oa}','ready','PRIVATE_A'),('${b}','${ob}','active','PRIVATE_B');`);
    await assert.rejects(
      db.exec(
        `insert into customer_esims(user_id,order_id,status) values ('${a}','${ob}','ready')`,
      ),
      /foreign key/,
    );
    await db.exec("set role anon");
    await assert.rejects(
      db.query("select * from customer_orders"),
      /permission denied/,
    );
    await assert.rejects(
      db.query("select activation_code from customer_esims"),
      /permission denied/,
    );
    await db.exec("reset role; set role authenticated");
    for (const [owner, order, secret] of [
      [a, oa, "PRIVATE_A"],
      [b, ob, "PRIVATE_B"],
    ]) {
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        owner,
      ]);
      assert.deepEqual(
        (await db.query("select id from customer_orders")).rows,
        [{ id: order }],
      );
      assert.deepEqual(
        (await db.query("select activation_code from customer_esims")).rows,
        [{ activation_code: secret }],
      );
      for (const sql of [
        "update customer_orders set status='completed'",
        "delete from customer_esims",
        `insert into customer_esims(user_id,order_id,status) values ('${owner}','${order}','ready')`,
      ])
        await assert.rejects(db.exec(sql), /permission denied/);
    }
    await db.query("select set_config('request.jwt.claim.sub','',false)");
    assert.equal(
      (await db.query("select * from customer_orders")).rows.length,
      0,
    );
  } finally {
    await db.close();
  }
});
