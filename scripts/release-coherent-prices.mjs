// Owner-approved retail campaign. No provider purchases, order edits or wholesale writes.
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { parse } from "csv-parse/sync";
import {
  buildStripeCatalog,
  liveSecret,
  testSecret,
} from "./lib/stripe-catalog.mjs";
import {
  createEsimAccessAPI,
  esimAccessConfig,
} from "../src/lib/integrations/esimaccess-api.ts";
import { compareProviderCatalog } from "../src/lib/integrations/esimaccess-catalog.ts";
import { auditContribution } from "./lib/profitability-audit.mjs";
process.loadEnvFile(".env.local");
const folder = "private-data/pricing-audit/release-2026-11-06";
fs.mkdirSync(folder, { recursive: true });
const read = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const save = (name, data) =>
  fs.writeFileSync(
    `${folder}/${name}.json`,
    JSON.stringify(data, null, 2) + "\n",
  );
const hash = (x) =>
  createHash("sha256")
    .update(typeof x === "string" ? x : JSON.stringify(x))
    .digest("hex");
const campaign = "coherence-2026-11-06-approved";
let stage = "configuration";
try {
  const mode = process.argv[2] ?? "--check";
  assert.ok(
    ["--check", "--prepare", "--apply", "--verify", "--defaults"].includes(
      mode,
    ),
  );
  const proposal = read("src/data/catalog-preview-prices.json");
  const source = fs.readFileSync(
    "private-data/pricing-audit/propuesta_aprobada_local.csv",
    "utf8",
  );
  assert.equal(hash(source), proposal.sourceSha256);
  const csv = parse(source, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
  });
  const ids = Object.keys(proposal.prices).sort();
  assert.equal(ids.length, 355);
  assert.equal(csv.length, ids.length);
  for (const row of csv) {
    const p = proposal.prices[row.plan_id];
    assert.equal(Number(row.precio_web_usd) * 100, p.previousCents);
    assert.equal(Number(row.precio_propuesto_usd) * 100, p.proposedCents);
  }
  const db = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_CHECKOUT_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  async function fetchRows(table, fields) {
    const out = [];
    for (let i = 0; i < ids.length; i += 150) {
      const r = await db
        .from(table)
        .select(fields)
        .in(
          table === "catalog_plans" ? "id" : "plan_id",
          ids.slice(i, i + 150),
        );
      if (r.error) throw Error("database_read");
      out.push(...r.data);
    }
    return out;
  }
  async function historical() {
    const out = [];
    for (let i = 0; i < 100000; i += 500) {
      const r = await db
        .from("checkout_order_items")
        .select(
          "order_id,plan_id,quantity,unit_amount,stripe_price_id,payment_unit_amount,payment_stripe_price_id",
        )
        .order("order_id")
        .order("plan_id")
        .range(i, i + 499);
      if (r.error) throw Error("history_read");
      out.push(...r.data);
      if (r.data.length < 500) return out;
    }
    throw Error("history_limit");
  }
  const prior = await db
    .from("pricing_campaign_changes")
    .select("*")
    .eq("campaign", campaign);
  if (prior.error) throw Error("ledger_read");
  const applied = prior.data.length > 0;
  if (applied) assert.equal(prior.data.length, ids.length);
  const catalog = await fetchRows(
    "catalog_plans",
    "id,name,allowance,data_gb,days,kind,coverage_code,details,destination_slug,retail_price_cents,is_published",
  );
  const bindings = await fetchRows("stripe_catalog_prices", "*");
  assert.equal(catalog.length, ids.length);
  assert.equal(bindings.length, ids.length * 2);
  for (const row of catalog) {
    const p = proposal.prices[row.id];
    assert.equal(
      row.retail_price_cents,
      applied ? p.proposedCents : p.previousCents,
    );
    assert.equal(row.is_published, true);
    assert.equal(row.kind, "fixed");
    assert.equal(p.proposedCents % 100, 0);
    for (const live of [false, true]) {
      const b = bindings.find(
        (x) => x.plan_id === row.id && x.livemode === live,
      );
      assert.equal(b.amount_cents, row.retail_price_cents);
    }
  }
  const currentHistory = await historical();
  if (!fs.existsSync(`${folder}/baseline.json`))
    save("baseline", {
      campaign,
      sourceSha256: proposal.sourceSha256,
      at: new Date().toISOString(),
      catalog,
      bindings,
      history: currentHistory,
    });
  const baseline = read(`${folder}/baseline.json`);
  assert.equal(baseline.sourceSha256, proposal.sourceSha256);
  for (const old of baseline.history)
    assert.deepEqual(
      currentHistory.find(
        (x) => x.order_id === old.order_id && x.plan_id === old.plan_id,
      ),
      old,
    );
  if (mode === "--verify" || applied) {
    assert.equal(applied, true);
    for (const id of ids) {
      const r = prior.data.find((x) => x.plan_id === id);
      assert.equal(r.old_cents, proposal.prices[id].previousCents);
      assert.equal(r.new_cents, proposal.prices[id].proposedCents);
    }
    save("verification", {
      at: new Date().toISOString(),
      count: ids.length,
      historicalRowsUnchanged: baseline.history.length,
      sourceSha256: proposal.sourceSha256,
    });
    if (mode === "--defaults") {
      for (const name of ["test", "live"]) {
        stage = `Stripe ${name} default prices`;
        const live = name === "live";
        const stripe = new Stripe(
          live
            ? liveSecret(process.env.STRIPE_LIVE_SECRET_KEY)
            : testSecret(process.env.STRIPE_TEST_SECRET_KEY),
          { maxNetworkRetries: 2, timeout: 20000 },
        );
        let cursor = 0,
          failure,
          completed = 0;
        async function worker() {
          while (!failure && cursor < ids.length) {
            const id = ids[cursor++];
            try {
              const b = bindings.find(
                (b) => b.plan_id === id && b.livemode === live,
              );
              const product = await stripe.products.update(b.product_id, {
                default_price: b.price_id,
              });
              assert.equal(product.metadata.mts_plan_id, id);
              assert.equal(product.livemode, live);
              assert.equal(product.default_price, b.price_id);
              completed++;
            } catch (error) {
              failure ??= error;
            }
          }
        }
        await Promise.all(Array.from({ length: 4 }, worker));
        if (failure) throw failure;
        save(`defaults-${name}`, {
          at: new Date().toISOString(),
          verified: completed,
        });
        console.log(
          `${name}: ${completed} product default prices synchronized`,
        );
      }
    }
    console.log(
      JSON.stringify({
        applied: ids.length,
        historyUnchanged: baseline.history.length,
      }),
    );
    process.exit(0);
  }
  stage = "fresh provider verification";
  const packages = await createEsimAccessAPI(
    esimAccessConfig(process.env),
  ).privateCostPackages();
  const match = compareProviderCatalog(
    catalog.map((p) => ({
      id: p.id,
      allowance: p.allowance,
      days: p.days,
      coverageCode: p.coverage_code,
    })),
    packages,
  );
  assert.equal(match.matches.length, ids.length);
  const verifiedCosts = [];
  for (const id of ids) {
    const p = packages.find((p) => p.slug === id);
    const original = csv.find((r) => r.plan_id === id);
    assert.ok(Number.isSafeInteger(p.wholesaleUnitUnits));
    assert.equal(
      p.wholesaleUnitUnits,
      Math.round(Number(original.coste_mayorista_usd) * 10000),
    );
    const result = auditContribution(
      proposal.prices[id].proposedCents,
      p.wholesaleUnitUnits,
      {
        feeBps: 540,
        fixedFeeUnits: 3000,
        radarUnits: 500,
        affiliateBps: 800,
        minContributionBps: 2000,
      },
    );
    assert.equal(result.meetsFloor, true);
    verifiedCosts.push({
      planId: id,
      wholesaleUnits: p.wholesaleUnitUnits,
      marginBps: result.marginBps,
    });
  }
  save("preflight", {
    at: new Date().toISOString(),
    count: ids.length,
    sourceSha256: proposal.sourceSha256,
    verifiedCosts,
  });
  console.log(
    JSON.stringify({
      preflight: ids.length,
      minimumContributionBps: Math.min(
        ...verifiedCosts.map((p) => p.marginBps),
      ),
      alreadyApplied: false,
    }),
  );
  if (mode === "--check") process.exit(0);
  const prepared = {};
  const byDestination = {};
  for (const p of catalog)
    (byDestination[p.destination_slug] ??= []).push({
      id: p.id,
      name: p.name,
      kind: p.kind,
      days: p.days,
      dataGb: Number(p.data_gb),
      retailPriceCents: proposal.prices[p.id].proposedCents,
    });
  const rows = buildStripeCatalog(
    read("src/data/destinations.json"),
    byDestination,
  );
  for (const name of ["test", "live"]) {
    stage = `Stripe ${name} preparation`;
    const live = name === "live";
    const stripe = new Stripe(
      live
        ? liveSecret(process.env.STRIPE_LIVE_SECRET_KEY)
        : testSecret(process.env.STRIPE_TEST_SECRET_KEY),
      { maxNetworkRetries: 2, timeout: 20000 },
    );
    if (live)
      assert.equal((await stripe.accounts.retrieve()).charges_enabled, true);
    const existing = new Map();
    for await (const p of stripe.prices.list({ limit: 100 }))
      if (p.lookup_key) existing.set(p.lookup_key, p);
    const out = [];
    // Prepare immutable prices only. Existing product defaults and current bindings stay untouched.
    let cursor = 0,
      failure;
    async function worker() {
      while (!failure && cursor < rows.length) {
        const r = rows[cursor++];
        try {
          const old = bindings.find(
            (b) => b.plan_id === r.planId && b.livemode === live,
          );
          assert.equal(old.product_id, r.productId);
          let price = existing.get(r.lookupKey);
          if (!price)
            price = await stripe.prices.create(
              {
                product: r.productId,
                currency: "usd",
                unit_amount: r.unitAmount,
                lookup_key: r.lookupKey,
                metadata: {
                  mts_plan_id: r.planId,
                  mts_destination: r.destination,
                },
              },
              { idempotencyKey: "price_" + hash(r.lookupKey).slice(0, 32) },
            );
          assert.equal(price.unit_amount, r.unitAmount);
          assert.equal(price.product, r.productId);
          assert.equal(price.metadata.mts_plan_id, r.planId);
          assert.equal(price.currency, "usd");
          assert.equal(price.livemode, live);
          assert.equal(price.active, true);
          out.push({
            planId: r.planId,
            priceId: price.id,
            productId: r.productId,
            amount: r.unitAmount,
          });
          if (out.length % 100 === 0 || out.length === rows.length)
            console.log(
              `${name}: ${out.length}/${rows.length} prices prepared`,
            );
        } catch (e) {
          failure ??= e;
        }
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker));
    save(`prepared-${name}`, out);
    if (failure) throw failure;
    prepared[name] = out;
  }
  if (mode === "--prepare") {
    console.log("Prepared only. Catalog and order prices unchanged.");
    process.exit(0);
  }
  stage = "atomic catalog publication";
  const changes = ids.map((id) => ({
    plan_id: id,
    old_cents: proposal.prices[id].previousCents,
    new_cents: proposal.prices[id].proposedCents,
    product_id: prepared.live.find((p) => p.planId === id).productId,
    live_price_id: prepared.live.find((p) => p.planId === id).priceId,
    test_price_id: prepared.test.find((p) => p.planId === id).priceId,
  }));
  save("approved-bindings", changes);
  const result = await db.rpc("apply_commercial_price_revision", {
    p_campaign: campaign,
    p_changes: changes,
    p_excluded: [],
    p_source_sha256: proposal.sourceSha256,
  });
  if (result.error) throw Error("atomic_publish");
  assert.equal(result.data, ids.length);
  const after = await fetchRows("catalog_plans", "id,retail_price_cents");
  for (const row of after)
    assert.equal(row.retail_price_cents, proposal.prices[row.id].proposedCents);
  const afterHistory = await historical();
  for (const old of baseline.history)
    assert.deepEqual(
      afterHistory.find(
        (x) => x.order_id === old.order_id && x.plan_id === old.plan_id,
      ),
      old,
    );
  const bundled = read("src/data/retail-prices.json");
  for (const id of ids) bundled[id] = proposal.prices[id].proposedCents;
  fs.writeFileSync(
    "src/data/retail-prices.json",
    JSON.stringify(bundled, null, 2) + "\n",
  );
  save("publication", {
    at: new Date().toISOString(),
    campaign,
    applied: ids.length,
    historicalRowsUnchanged: baseline.history.length,
  });
  console.log(
    JSON.stringify({
      applied: ids.length,
      historyUnchanged: baseline.history.length,
    }),
  );
} catch (error) {
  console.error(
    JSON.stringify({
      failedStage: stage,
      kind: error?.name ?? "Error",
      message:
        "Release stopped; credentials and provider costs not printed. Check private evidence.",
    }),
  );
  process.exitCode = 1;
}
