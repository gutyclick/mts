import fs from "node:fs";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import {
  buildStripeCatalog,
  syncStripeCatalog,
  liveSecret,
  testSecret,
} from "./lib/stripe-catalog.mjs";
import { priceProposal } from "./lib/pricing-policy.mjs";
process.loadEnvFile(".env.local");
async function main() {
  try {
    const read = (p) =>
      JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
    const config = read("private-data/pricing/policy.json");
    const file = "private-data/pricing/" + config.campaign + "-preview.json",
      preview = read(file);
    if (
      process.argv.slice(2).join(" ") !== "--apply" ||
      preview.campaign !== config.campaign ||
      JSON.stringify(preview.policy) !== JSON.stringify(config) ||
      Date.now() - Date.parse(preview.createdAt) > 3600000
    )
      throw Error("Fresh matching preview and --apply required");
    const db = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_CHECKOUT_SECRET_KEY,
      { auth: { persistSession: false } },
    );
    const selected = preview.results.filter((r) => r.status === "eligible");
    if (
      !selected.length ||
      selected.length > 500 ||
      new Set(selected.map((p) => p.destination)).size > 20
    )
      throw Error("Invalid pilot size");
    const ids = selected.map((p) => p.planId);
    const prior = await db
      .from("pricing_campaign_changes")
      .select("plan_id,new_cents")
      .eq("campaign", config.campaign);
    if (prior.error) throw Error("Campaign ledger unavailable");
    if (prior.data.length) {
      if (
        prior.data.length !== selected.length ||
        prior.data.some(
          (p) =>
            !selected.some(
              (s) => s.planId === p.plan_id && s.proposedCents === p.new_cents,
            ),
        )
      )
        throw Error("Campaign replay differs");
      console.log("Campaign already applied. No additional increase.");
      return;
    }
    const current = await db
      .from("catalog_plans")
      .select("id,retail_price_cents,is_published,kind")
      .in("id", ids);
    if (current.error || current.data.length !== ids.length)
      throw Error("Catalog verification failed");
    for (const p of selected) {
      const actual = current.data.find((r) => r.id === p.planId);
      const checked = priceProposal(
        {
          baseCents: actual.retail_price_cents,
          anchorCents: preview.anchors[p.planId],
          wholesaleUnits: p.wholesaleUnits,
          costCheckedAt: p.costCheckedAt,
          market: p.market,
        },
        config,
      );
      if (
        !actual.is_published ||
        actual.kind !== "fixed" ||
        actual.retail_price_cents !== p.currentCents ||
        checked.status !== "eligible" ||
        checked.proposedCents !== p.proposedCents
      )
        throw Error("Price controls changed");
    }
    const destinations = read("src/data/destinations.json");
    const plans = {};
    for (const p of selected)
      (plans[p.destination] ??= []).push({
        id: p.planId,
        name: p.name,
        kind: "fixed",
        retailPriceCents: p.proposedCents,
        dataGb: p.dataGb,
        days: p.days,
      });
    const rows = buildStripeCatalog(destinations, plans);
    const result = {};
    for (const mode of ["test", "live"]) {
      const key =
        mode === "live"
          ? liveSecret(process.env.STRIPE_LIVE_SECRET_KEY)
          : testSecret(process.env.STRIPE_TEST_SECRET_KEY);
      const stripe = new Stripe(key, { maxNetworkRetries: 2, timeout: 20000 });
      if (
        mode === "live" &&
        !(await stripe.accounts.retrieve()).charges_enabled
      )
        throw Error("Live account not enabled");
      result[mode] = await syncStripeCatalog(
        stripe,
        rows,
        () => {},
        mode === "live",
      );
      for (const binding of result[mode]) {
        const price = await stripe.prices.retrieve(binding.priceId);
        if (
          price.livemode !== (mode === "live") ||
          !price.active ||
          price.currency !== "usd" ||
          price.unit_amount !== binding.unitAmount ||
          price.product !== binding.productId ||
          price.metadata.mts_plan_id !== binding.planId
        )
          throw Error("Independent Stripe verification failed");
      }
      console.log(
        mode +
          ": " +
          rows.length +
          " prices prepared and verified. No charges.",
      );
    }
    const changes = selected.map((p) => ({
      plan_id: p.planId,
      old_cents: p.currentCents,
      new_cents: p.proposedCents,
      product_id: result.live.find((b) => b.planId === p.planId).productId,
      live_price_id: result.live.find((b) => b.planId === p.planId).priceId,
      test_price_id: result.test.find((b) => b.planId === p.planId).priceId,
    }));
    fs.writeFileSync(
      "private-data/pricing/" + config.campaign + "-bindings.json",
      JSON.stringify(changes, null, 2),
    );
    const applied = await db.rpc("apply_pricing_campaign", {
      p_campaign: config.campaign,
      p_changes: changes,
    });
    if (applied.error || applied.data !== selected.length)
      throw Error("Atomic campaign publication failed");
    const bundled = read("src/data/retail-prices.json");
    for (const p of selected) bundled[p.planId] = p.proposedCents;
    fs.writeFileSync(
      "src/data/retail-prices.json",
      JSON.stringify(bundled, null, 2) + "\n",
    );
    const verify = await db
      .from("catalog_plans")
      .select("id,retail_price_cents")
      .in("id", ids);
    if (
      verify.error ||
      verify.data.length !== selected.length ||
      verify.data.some(
        (p) =>
          selected.find((s) => s.planId === p.id).proposedCents !==
          p.retail_price_cents,
      )
    )
      throw Error("Post-publication check failed");
    console.log(
      JSON.stringify({
        applied: applied.data,
        destinations: [...new Set(selected.map((p) => p.destination))],
        minimumContributionBps: Math.min(
          ...selected.map((p) => p.contributionBps),
        ),
      }),
    );
  } catch {
    console.error(
      "Pricing workflow stopped. Check private configuration, source freshness and provider permissions. No credentials or wholesale values printed.",
    );
    process.exitCode = 1;
  }
}
await main();
