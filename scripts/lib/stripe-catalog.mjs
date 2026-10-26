import { createHash } from "node:crypto";
import { planVariant } from "../../src/lib/plan-variants.ts";

const hash = (value) =>
  createHash("sha256").update(value).digest("hex").slice(0, 32);
export function buildStripeCatalog(destinations, plansByDestination) {
  const seen = new Set();
  const rows = [];
  for (const destination of destinations) {
    for (const plan of plansByDestination[destination.slug] ?? []) {
      if (
        seen.has(plan.id) ||
        !plan.id ||
        plan.kind !== "fixed" ||
        !Number.isSafeInteger(plan.retailPriceCents) ||
        plan.retailPriceCents < 1 ||
        plan.retailPriceCents > 100000000 ||
        !Number.isFinite(plan.dataGb) ||
        plan.dataGb <= 0 ||
        !Number.isInteger(plan.days) ||
        plan.days <= 0
      )
        throw new Error("Invalid or duplicate retail plan");
      seen.add(plan.id);
      const variant = planVariant(plan, "es").label;
      // Explicit projection: supplier costs and arbitrary source fields never leave this boundary.
      rows.push({
        planId: plan.id,
        destination: destination.slug,
        name: `${destination.name.es} · ${plan.dataGb} GB · ${plan.days} días · ${variant}`,
        variant,
        dataGb: plan.dataGb,
        days: plan.days,
        currency: "usd",
        unitAmount: plan.retailPriceCents,
        productId: `mts_${hash(plan.id)}`,
        lookupKey: `mts_${hash(plan.id)}_usd_${plan.retailPriceCents}`,
      });
    }
  }
  if (!rows.length) throw new Error("Empty catalog");
  return rows.sort((a, b) => a.planId.localeCompare(b.planId));
}

export function testSecret(value) {
  if (!/^(sk|rk)_test_[a-zA-Z0-9]{16,}$/.test(value ?? ""))
    throw new Error("A Stripe test secret is required; live keys are rejected");
  return value;
}

export function liveSecret(value) {
  if (!/^(sk|rk)_live_[a-zA-Z0-9]{16,}$/.test(value ?? ""))
    throw new Error("A Stripe live secret is required");
  return value;
}
export async function syncStripeCatalog(
  stripe,
  rows,
  onProgress = () => {},
  live = false,
) {
  const products = new Map();
  const prices = new Map();
  for await (const product of stripe.products.list({ limit: 100 })) {
    if (product.livemode !== live)
      throw new Error("Stripe environment mismatch");
    products.set(product.id, product);
  }
  for await (const price of stripe.prices.list({ limit: 100 })) {
    if (price.livemode !== live) throw new Error("Stripe environment mismatch");
    if (price.lookup_key) prices.set(price.lookup_key, price);
  }
  // Check all existing identities before performing any writes.
  for (const row of rows) {
    const product = products.get(row.productId);
    const price = prices.get(row.lookupKey);
    if (
      product &&
      (product.metadata?.mts_plan_id !== row.planId || !product.active)
    )
      throw new Error("Product identity conflict or archived product");
    if (
      price &&
      (price.product !== row.productId ||
        price.currency !== "usd" ||
        price.unit_amount !== row.unitAmount ||
        price.type !== "one_time" ||
        !price.active ||
        price.metadata?.mts_plan_id !== row.planId)
    )
      throw new Error("Price identity conflict or archived price");
  }
  const bindings = new Array(rows.length);
  let next = 0;
  let completed = 0;
  let failure;
  async function syncRow(row, index) {
    let product = products.get(row.productId);
    const metadata = {
      mts_plan_id: row.planId,
      mts_destination: row.destination,
    };
    if (!product) {
      product = await stripe.products.create(
        {
          id: row.productId,
          name: row.name,
          metadata,
          shippable: false,
        },
        {
          idempotencyKey: `product_${hash(JSON.stringify([row.productId, row.name, metadata]))}`,
        },
      );
    } else if (product.name !== row.name) {
      product = await stripe.products.update(row.productId, { name: row.name });
    }
    let price = prices.get(row.lookupKey);
    if (!price) {
      price = await stripe.prices.create(
        {
          product: product.id,
          currency: "usd",
          unit_amount: row.unitAmount,
          lookup_key: row.lookupKey,
          metadata,
        },
        { idempotencyKey: `price_${hash(row.lookupKey)}` },
      );
    }
    if (product.livemode !== live || price.livemode !== live)
      throw new Error("Stripe environment mismatch");
    if (product.default_price !== price.id)
      await stripe.products.update(product.id, { default_price: price.id });
    bindings[index] = {
      planId: row.planId,
      productId: product.id,
      priceId: price.id,
      unitAmount: row.unitAmount,
      currency: "usd",
    };
    completed++;
    if (completed % 50 === 0 || completed === rows.length)
      onProgress(completed, rows.length);
  }
  // Independent products can sync concurrently. Keep requests below sandbox rate limits.
  // On failure, stop scheduling and await all in-flight writes before returning control.
  async function worker() {
    while (!failure && next < rows.length) {
      const index = next++;
      try {
        await syncRow(rows[index], index);
      } catch (error) {
        failure ??= error;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(4, rows.length) }, worker));
  if (failure) throw failure;
  return bindings;
}

export function catalogCSV(rows) {
  const fields = [
    "planId",
    "destination",
    "name",
    "variant",
    "dataGb",
    "days",
    "currency",
    "unitAmount",
    "productId",
    "lookupKey",
  ];
  const cell = (value) => `"${String(value).replaceAll('"', '""')}"`;
  return (
    "\uFEFF" +
    [fields, ...rows.map((row) => fields.map((key) => row[key]))]
      .map((row) => row.map(cell).join(","))
      .join("\r\n") +
    "\r\n"
  );
}
