import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import {
  createEsimAccessAPI,
  esimAccessConfig,
  EsimAccessError,
  projectFixedPackages,
} from "../src/lib/integrations/esimaccess-api.ts";
import { compareProviderCatalog } from "../src/lib/integrations/esimaccess-catalog.ts";

const config = {
  accessCode: randomBytes(16).toString("hex"),
  secretKey: randomBytes(32).toString("hex"),
};
const fixed = {
  packageCode: "fixture-code",
  slug: "JP_1_7",
  name: "Japan 1GB 7Days",
  dataType: 1,
  volume: 1024 ** 3,
  duration: 7,
  durationUnit: "DAY",
  location: "JP",
  activeType: 2,
  speed: "4G/5G",
  price: 999,
  retailPrice: 999,
};
const response = (obj) => Response.json({ success: true, errorCode: "0", obj });
test("supplier catalog requests sign the exact serialized body and strip all commercial fields and daily plans", async () => {
  const api = createEsimAccessAPI(config, async (url, options) => {
    assert.equal(url, "https://api.esimaccess.com/api/v1/open/package/list");
    assert.equal(options.method, "POST");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    assert.deepEqual(JSON.parse(options.body), { type: "BASE", dataType: "1" });
    const headers = options.headers;
    assert.equal(headers["RT-AccessCode"], config.accessCode);
    assert.equal(
      headers["RT-Signature"],
      createHmac("sha256", config.secretKey)
        .update(
          headers["RT-Timestamp"] +
            headers["RT-RequestID"] +
            config.accessCode +
            options.body,
        )
        .digest("hex"),
    );
    return response({
      packageList: [fixed, { ...fixed, slug: "daily", dataType: 2 }],
    });
  });
  const plans = await api.listFixedPackages();
  assert.equal(plans.length, 1);
  assert.equal(plans[0].volumeBytes, 1024 ** 3);
  assert.equal(plans[0].activation, "network");
  assert.ok(!JSON.stringify(plans).match(/price|retail|999|ipExport/i));
  assert.throws(() => projectFixedPackages([fixed, fixed]), EsimAccessError);
  assert.throws(
    () => projectFixedPackages([{ ...fixed, dataType: 4 }]),
    EsimAccessError,
  );
});
test("configuration and upstream failures never expose credentials or response contents", async () => {
  assert.equal(esimAccessConfig({}), null);
  assert.throws(
    () => esimAccessConfig({ ESIM_ACCESS_CODE: config.accessCode }),
    EsimAccessError,
  );
  for (const transport of [
    async () => {
      throw new Error(config.secretKey);
    },
    async () => new Response(config.accessCode, { status: 403 }),
    async () =>
      Response.json({
        success: false,
        errorCode: "100001",
        errorMsg: config.secretKey,
      }),
    async () => new Response(config.secretKey),
    async () =>
      new Response("{}", {
        headers: { "content-length": String(17 * 1024 ** 2) },
      }),
  ])
    await assert.rejects(
      createEsimAccessAPI(config, transport).listFixedPackages(),
      (error) => {
        assert.ok(error instanceof EsimAccessError);
        assert.ok(!String(error).includes(config.secretKey));
        assert.ok(!String(error).includes(config.accessCode));
        return true;
      },
    );
});
test("plan binding uses exact aliases, MB/GB units, duration and declared country coverage", () => {
  const local = [
    { id: "JP_1_7", allowance: "1GB", days: 7, coverageCode: "JP" },
    { id: "JP_0.1_7", allowance: "100MB", days: 7, coverageCode: "JP" },
  ];
  const remote = projectFixedPackages([
    fixed,
    {
      ...fixed,
      packageCode: "small-code",
      slug: "JP_0.1_7",
      volume: 100 * 1024 ** 2,
    },
  ]);
  assert.equal(compareProviderCatalog(local, remote).matches.length, 2);
  assert.equal(
    compareProviderCatalog(local, [
      { ...remote[0], volumeBytes: 1000 ** 3 },
      remote[1],
    ]).matches.length,
    2,
  );
  assert.equal(
    compareProviderCatalog(local, [{ ...remote[0], days: 30 }]).conflicts[0]
      .reason,
    "duration",
  );
  assert.equal(
    compareProviderCatalog(local, [{ ...remote[0], volumeBytes: 1 }])
      .conflicts[0].reason,
    "data",
  );
  assert.equal(
    compareProviderCatalog(local, [{ ...remote[0], coverage: ["US"] }])
      .conflicts[0].reason,
    "coverage",
  );
  assert.deepEqual(
    compareProviderCatalog(local, [{ ...remote[0], slug: "other" }]).missing,
    local.map((p) => p.id),
  );
});
test("profile and usage queries stay scoped to requested supplier references and parse QR locally", async () => {
  let calls = 0;
  const api = createEsimAccessAPI(config, async (url, options) => {
    calls++;
    if (url.endsWith("esim/query")) {
      assert.equal(JSON.parse(options.body).orderNo, "fixture-order");
      return response({
        esimList: [
          {
            esimTranNo: "fixture-transaction",
            orderNo: "fixture-order",
            iccid: "8900000000000000000",
            ac: "LPA:1$smdp.example.invalid$fixture-activation",
            esimStatus: "GOT_RESOURCE",
            smdpStatus: "RELEASED",
            totalVolume: 1024 ** 3,
            orderUsage: 0,
            qrCodeUrl: "https://untrusted.invalid/private.png",
          },
        ],
      });
    }
    return response({
      esimUsageList: [
        {
          esimTranNo: "fixture-transaction",
          dataUsage: 100,
          totalData: 1024 ** 3,
          lastUpdateTime: "2026-10-24T12:00:00Z",
        },
      ],
    });
  });
  const profiles = await api.orderProfiles("fixture-order");
  assert.equal(profiles[0].smdpAddress, "smdp.example.invalid");
  assert.equal(profiles[0].activationCode, "fixture-activation");
  assert.ok(!("qrCodeUrl" in profiles[0]));
  assert.equal((await api.usage(["fixture-transaction"]))[0].usedBytes, 100);
  assert.equal(calls, 2);
  await assert.rejects(
    api.usage(Array(11).fill("fixture-transaction")),
    EsimAccessError,
  );
  const foreign = createEsimAccessAPI(config, async () =>
    response({
      esimUsageList: [
        {
          esimTranNo: "foreign",
          dataUsage: 0,
          totalData: 10,
          lastUpdateTime: "2026-10-24",
        },
      ],
    }),
  );
  await assert.rejects(foreign.usage(["fixture-transaction"]), EsimAccessError);
});
test("supplier bindings are private, sync is restricted and failed batches roll back", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role bypassrls; create table public.catalog_plans(id text primary key,days integer,kind text,is_published boolean); insert into public.catalog_plans values ('JP_1_7',7,'fixed',true);",
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/20261024000300_provider_bindings.sql",
        "utf8",
      ),
    );
    await db.exec(
      readFileSync(
        "supabase/migrations/20261024000400_provider_safe_refresh.sql",
        "utf8",
      ),
    );
    const binding = {
      plan_id: "JP_1_7",
      provider_slug: "JP_1_7",
      package_code: "fixture-code",
      volume_bytes: 1024 ** 3,
      days: 7,
    };
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await assert.rejects(
        db.query("select * from public.provider_package_bindings"),
        /permission denied/,
      );
      await assert.rejects(
        db.query("select public.sync_esim_access_bindings($1::jsonb)", [
          JSON.stringify([binding]),
        ]),
        /permission denied/,
      );
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    const query =
      "select public.sync_esim_access_bindings($1::jsonb) as result";
    assert.equal(
      (await db.query(query, [JSON.stringify([binding])])).rows[0].result
        .available,
      1,
    );
    await assert.rejects(
      db.query(query, [JSON.stringify([{ ...binding, days: 30 }])]),
      /identity mismatch/,
    );
    await assert.rejects(
      db.query(query, [JSON.stringify([{ ...binding, price: 100 }])]),
      /Invalid binding fields/,
    );
    await assert.rejects(db.query(query, ["[]"]), /Invalid binding count/);
    assert.equal(
      (
        await db.query(
          "select is_available from public.provider_package_bindings",
        )
      ).rows[0].is_available,
      true,
    );
  } finally {
    await db.close();
  }
});
