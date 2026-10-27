// Operator-only, owner-approved revision. Never changes customer orders or supplier costs.
import fs from "node:fs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
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
process.loadEnvFile(".env.local");
const root = "private-data/pricing/corrected-2026-10-27";
const read = (p) => JSON.parse(fs.readFileSync(root + "/" + p, "utf8"));
const save = (p, value) =>
  fs.writeFileSync(root + "/" + p, JSON.stringify(value, null, 2));
const digest = (x) =>
  createHash("sha256")
    .update(typeof x === "string" ? x : JSON.stringify(x))
    .digest("hex");
const campaign = "corrected-2026-10-27-approved";
let stage = "validation";
try {
  assert.deepEqual(process.argv.slice(2), ["--apply"]);
  const preview = read("preview.json"),
    baseline = read("baseline-before-any-change.json"),
    suspension = read("suspension-result.json");
  assert.equal(
    digest(fs.readFileSync(root + "/source.csv", "utf8")),
    preview.summary.sourceSha256,
  );
  assert.equal(baseline.sourceSha256, preview.summary.sourceSha256);
  const selected = preview.changes.filter(
    (p) => p.accion === "SUBIR" || p.accion === "BAJAR",
  );
  const excluded = preview.changes
    .filter((p) => p.recomendar_ocultar === "SI")
    .map((p) => p.plan_id)
    .sort();
  assert.equal(selected.length, 590);
  assert.equal(selected.filter((p) => p.accion === "SUBIR").length, 511);
  assert.equal(selected.filter((p) => p.accion === "BAJAR").length, 79);
  assert.equal(excluded.length, 165);
  for (const p of selected) {
    assert.ok(!excluded.includes(p.plan_id));
    assert.equal(p.new_cents % 100, 0);
    assert.ok(p.new_cents > 0);
    assert.equal(p.alertas, "");
  }
  const db = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_CHECKOUT_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  async function catalog() {
    const out = [];
    for (let i = 0; i < baseline.catalog.length; i += 200) {
      const r = await db
        .from("catalog_plans")
        .select("id,retail_price_cents,is_published")
        .in(
          "id",
          baseline.catalog.slice(i, i + 200).map((p) => p.id),
        );
      if (r.error) throw Error("Catalog verification failed");
      out.push(...r.data);
    }
    assert.equal(out.length, baseline.catalog.length);
    return out;
  }
  async function ledger() {
    const r = await db
      .from("pricing_campaign_changes")
      .select("*")
      .eq("campaign", campaign);
    if (r.error) throw Error("Ledger unavailable");
    return r.data;
  }
  const prior = await ledger();
  const paused = new Set(suspension.rows.map((p) => p.id));
  function verifyCurrent(current, applied) {
    for (const p of current) {
      const base = baseline.catalog.find((b) => b.id === p.id),
        change = selected.find((s) => s.plan_id === p.id);
      assert.equal(
        p.retail_price_cents,
        applied && change ? change.new_cents : base.retail_price_cents,
      );
      assert.equal(
        p.is_published,
        paused.has(p.id) ? false : base.is_published,
      );
    }
  }
  if (prior.length) {
    assert.equal(prior.length, 590);
    for (const r of prior) {
      const s = selected.find((p) => p.plan_id === r.plan_id);
      assert.equal(r.old_cents, s.old_cents);
      assert.equal(r.new_cents, s.new_cents);
    }
    verifyCurrent(await catalog(), true);
    console.log("Approved revision already applied; no further changes.");
    process.exit(0);
  }
  verifyCurrent(await catalog(), false);
  stage = "fresh wholesale validation";
  let raw = [];
  const provider = await createEsimAccessAPI(
    esimAccessConfig(process.env),
    async (url, options) => {
      if (String(url) !== "https://api.esimaccess.com/api/v1/open/package/list")
        throw Error("Read-only provider endpoint required");
      const r = await fetch(url, options);
      if (r.ok) raw = (await r.clone().json()).obj?.packageList ?? [];
      return r;
    },
  ).listFixedPackages();
  const audit = JSON.parse(
    fs.readFileSync("private-data/audits/full-prices/data.json", "utf8"),
  );
  const identities = selected.map((s) =>
    baseline.catalog.find((p) => p.id === s.plan_id),
  );
  const match = compareProviderCatalog(
    identities.map((p) => ({
      id: p.id,
      allowance: p.allowance,
      days: p.days,
      coverageCode: p.coverage_code,
    })),
    provider,
  );
  assert.equal(match.matches.length, 590);
  assert.equal(match.conflicts.length, 0);
  for (const p of selected) {
    const w = raw.find((w) => w.slug === p.plan_id),
      old = audit.rows.find((r) => r.plan_id === p.plan_id);
    assert.equal(w.currencyCode, "USD");
    assert.equal(w.price, old.precio_proveedor_unidades);
    const charged = Math.floor((p.new_cents * 9500) / 10000) * 100,
      net = charged - Math.ceil((charged * 1240) / 10000) - 3000 - w.price;
    assert.ok(net * 10000 >= charged * 2000);
  }
  save("approved-execution.json", {
    campaign,
    sourceSha256: preview.summary.sourceSha256,
    approvedAt: new Date().toISOString(),
    count: 590,
    excluded,
    wholesaleValidation:
      "590 current costs and identities unchanged; no supplier writes",
  });
  // Fingerprint immutable financial columns only. No names, emails or installation credentials.
  async function historicalItems() {
    const out = [];
    for (let offset = 0; ; offset += 500) {
      const r = await db
        .from("checkout_order_items")
        .select("order_id,plan_id,quantity,unit_amount,stripe_price_id")
        .order("order_id")
        .order("plan_id")
        .range(offset, offset + 499);
      if (r.error) throw Error("Historical verification unavailable");
      out.push(...r.data);
      if (r.data.length < 500) return out;
    }
  }
  const history = await historicalItems();
  save("historical-fingerprint-before.json", {
    count: history.length,
    sha256: digest(history),
  });
  const destinations = JSON.parse(
    fs.readFileSync("src/data/destinations.json", "utf8"),
  );
  const grouped = {};
  for (const s of selected) {
    const p = baseline.catalog.find((p) => p.id === s.plan_id);
    (grouped[p.destination_slug] ??= []).push({
      id: p.id,
      name: p.name,
      kind: p.kind,
      retailPriceCents: s.new_cents,
      dataGb: Number(p.data_gb),
      days: p.days,
    });
  }
  const rows = buildStripeCatalog(destinations, grouped);
  assert.equal(rows.length, 590);
  const prepared = {},
    clients = {},
    defaults = {};
  for (const mode of ["test", "live"]) {
    stage = "Stripe " + mode + " price preparation";
    const live = mode === "live";
    const stripe = new Stripe(
      live
        ? liveSecret(process.env.STRIPE_LIVE_SECRET_KEY)
        : testSecret(process.env.STRIPE_TEST_SECRET_KEY),
      { maxNetworkRetries: 2, timeout: 20000 },
    );
    clients[mode] = stripe;
    if (live)
      assert.equal((await stripe.accounts.retrieve()).charges_enabled, true);
    const products = new Map(),
      prices = new Map();
    for await (const p of stripe.products.list({ limit: 100 }))
      products.set(p.id, p);
    for await (const p of stripe.prices.list({ limit: 100 }))
      if (p.lookup_key) prices.set(p.lookup_key, p);
    defaults[mode] = [];
    for (const row of rows) {
      const p = products.get(row.productId);
      assert.ok(p?.active);
      assert.equal(p.livemode, live);
      assert.equal(p.metadata.mts_plan_id, row.planId);
      const oldBinding = baseline.stripeBindings.find(
        (b) => b.plan_id === row.planId && b.livemode === live,
      );
      assert.equal(oldBinding.product_id, row.productId);
      defaults[mode].push({ productId: p.id, defaultPrice: p.default_price });
    }
    save("stripe-defaults-before-" + mode + ".json", defaults[mode]);
    let index = 0,
      completed = 0,
      failure;
    const out = new Array(rows.length);
    async function worker() {
      while (!failure && index < rows.length) {
        const i = index++,
          row = rows[i];
        try {
          let price = prices.get(row.lookupKey);
          if (!price)
            price = await stripe.prices.create(
              {
                product: row.productId,
                currency: "usd",
                unit_amount: row.unitAmount,
                lookup_key: row.lookupKey,
                metadata: {
                  mts_plan_id: row.planId,
                  mts_destination: row.destination,
                },
              },
              { idempotencyKey: "price_" + digest(row.lookupKey).slice(0, 32) },
            );
          assert.equal(price.active, true);
          assert.equal(price.livemode, live);
          assert.equal(price.product, row.productId);
          assert.equal(price.currency, "usd");
          assert.equal(price.unit_amount, row.unitAmount);
          assert.equal(price.metadata.mts_plan_id, row.planId);
          out[i] = {
            planId: row.planId,
            productId: row.productId,
            priceId: price.id,
            unitAmount: row.unitAmount,
          };
          completed++;
          if (completed % 50 === 0 || completed === rows.length)
            console.log(
              mode +
                ": " +
                completed +
                "/" +
                rows.length +
                " Stripe prices verified",
            );
        } catch (e) {
          failure ??= e;
        }
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker));
    save("stripe-prepared-" + mode + ".json", out.filter(Boolean));
    if (failure) throw failure;
    prepared[mode] = out;
  }
  stage = "atomic database publication";
  verifyCurrent(await catalog(), false);
  const changes = selected.map((s) => ({
    plan_id: s.plan_id,
    old_cents: s.old_cents,
    new_cents: s.new_cents,
    product_id: prepared.live.find((b) => b.planId === s.plan_id).productId,
    live_price_id: prepared.live.find((b) => b.planId === s.plan_id).priceId,
    test_price_id: prepared.test.find((b) => b.planId === s.plan_id).priceId,
  }));
  save("approved-bindings.json", changes);
  const applied = await db.rpc("apply_commercial_price_revision", {
    p_campaign: campaign,
    p_changes: changes,
    p_excluded: excluded,
    p_source_sha256: preview.summary.sourceSha256,
  });
  if (applied.error)
    throw Error("Atomic publication failed: " + applied.error.code);
  assert.equal(applied.data, 590);
  stage = "post-publication verification";
  verifyCurrent(await catalog(), true);
  assert.equal((await ledger()).length, 590);
  const afterHistory = await historicalItems();
  for (const before of history)
    assert.deepEqual(
      afterHistory.find(
        (r) => r.order_id === before.order_id && r.plan_id === before.plan_id,
      ),
      before,
    );
  const bundled = JSON.parse(
    fs.readFileSync("src/data/retail-prices.json", "utf8"),
  );
  for (const s of selected) bundled[s.plan_id] = s.new_cents;
  fs.writeFileSync(
    "src/data/retail-prices.json",
    JSON.stringify(bundled, null, 2) + "\n",
  );
  save("publication-result.json", {
    campaign,
    appliedAt: new Date().toISOString(),
    applied: 590,
    increased: 511,
    decreased: 79,
    excluded: 165,
    suspended: paused.size,
    historicalItemsVerified: history.length,
    otherCatalogPricesUnchanged: true,
    sourceSha256: preview.summary.sourceSha256,
  });
  // New checkouts use explicit binding IDs. Product defaults are only updated after the atomic commit; old prices remain available for existing orders.
  for (const mode of ["test", "live"]) {
    stage = "Stripe " + mode + " defaults";
    let next = 0,
      done = 0;
    async function worker() {
      while (next < prepared[mode].length) {
        const b = prepared[mode][next++];
        const original = defaults[mode].find(
          (d) => d.productId === b.productId,
        );
        if (original.defaultPrice !== b.priceId)
          await clients[mode].products.update(b.productId, {
            default_price: b.priceId,
          });
        done++;
        if (done % 100 === 0 || done === 590)
          console.log(mode + ": " + done + "/590 product defaults aligned");
      }
    }
    await Promise.all(Array.from({ length: 4 }, worker));
  }
  console.log(JSON.stringify(read("publication-result.json")));
} catch (e) {
  console.error(
    "Approved price revision stopped at " +
      stage +
      ". Details retained privately; no secrets printed.",
  );
  fs.writeFileSync(
    root + "/execution-error.json",
    JSON.stringify(
      {
        stage,
        message: e instanceof Error ? e.message : "unknown",
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
}
