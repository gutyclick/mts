import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  createEsimAccessAPI,
  esimAccessConfig,
} from "../src/lib/integrations/esimaccess-api.ts";
import { compareProviderCatalog } from "../src/lib/integrations/esimaccess-catalog.ts";
import { planVariant } from "../src/lib/plan-variants.ts";
import { priceProposal } from "./lib/pricing-policy.mjs";
process.loadEnvFile(".env.local");
try {
  const read = (p) =>
    JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));
  const policy = read("private-data/pricing/policy.json");
  if (
    !/^[a-z0-9-]{1,80}$/.test(policy.campaign) ||
    !Array.isArray(policy.destinations) ||
    policy.destinations.length > 20 ||
    new Set(policy.destinations).size !== policy.destinations.length
  )
    throw Error("Invalid campaign scope");
  const db = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_PUBLISHABLE_KEY,
    { auth: { persistSession: false } },
  );
  const plans = [];
  for (const slug of policy.destinations) {
    if (!/^[a-z0-9-]+$/.test(slug)) throw Error("Invalid destination");
    const r = await db
      .from("catalog_plans")
      .select(
        "id,name,allowance,data_gb,days,kind,coverage_code,details,retail_price_cents,destination_slug",
      )
      .eq("destination_slug", slug)
      .eq("is_published", true);
    if (r.error || !r.data?.length) throw Error("Catalog unavailable");
    plans.push(...r.data);
  }
  let raw = [];
  const api = createEsimAccessAPI(
    esimAccessConfig(process.env),
    async (url, options) => {
      if (String(url) !== "https://api.esimaccess.com/api/v1/open/package/list")
        throw Error("Read-only provider operation required");
      const response = await fetch(url, options);
      if (response.ok)
        raw = (await response.clone().json()).obj?.packageList ?? [];
      return response;
    },
  );
  const remote = await api.listFixedPackages(),
    costCheckedAt = Date.now();
  const match = compareProviderCatalog(
    plans.map((p) => ({
      id: p.id,
      allowance: p.allowance,
      days: p.days,
      coverageCode: p.coverage_code,
    })),
    remote,
  );
  if (match.conflicts.length) throw Error("Provider identity mismatch");
  const valid = new Set(match.matches.map((x) => x.planId)),
    wholesale = new Map(raw.map((p) => [p.slug, p]));
  const evidence = read("private-data/audits/demand-market-evidence.json");
  const anchorFile =
    "private-data/pricing/" + policy.campaign + "-anchors.json";
  const anchors = fs.existsSync(anchorFile)
    ? read(anchorFile)
    : Object.fromEntries(plans.map((p) => [p.id, p.retail_price_cents]));
  fs.writeFileSync(anchorFile, JSON.stringify(anchors, null, 2));
  const results = plans.map((p) => {
    const e = evidence[p.destination_slug],
      variant = planVariant(p, "en").label;
    const card = e?.cards.find((text) => {
      const gb = /([\d.]+)\s*GB/.exec(text),
        days = /Por\s*(\d+)\s*DÍAS/.exec(text);
      return (
        gb && days && Number(gb[1]) === p.data_gb && Number(days[1]) === p.days
      );
    });
    const price = card
      ?.split("USD")
      .at(-1)
      .match(/\d+(?:\.\d+)?/g)
      ?.at(-1);
    // Base country offers are comparable in allowance/validity/service class. Regional coverage and special IP variants require separate evidence.
    const equivalent =
      variant === "Standard" &&
      p.destination_slug !== "europe" &&
      p.details.coverage.length === 1;
    const w = wholesale.get(p.id);
    const proposal = priceProposal(
      {
        baseCents: p.retail_price_cents,
        anchorCents: anchors[p.id],
        wholesaleUnits:
          valid.has(p.id) && w?.currencyCode === "USD" ? w.price : null,
        costCheckedAt,
        market: price
          ? {
              ceilingCents: Math.round(Number(price) * 100),
              equivalent,
              checkedAt: e.checkedAt,
            }
          : null,
      },
      policy,
    );
    return {
      planId: p.id,
      destination: p.destination_slug,
      variant,
      dataGb: p.data_gb,
      days: p.days,
      name: p.name,
      wholesaleUnits: w?.price,
      coste_mayorista_usd:
        w?.currencyCode === "USD" ? (w.price / 10000).toFixed(4) : "",
      costCheckedAt,
      market: price
        ? {
            ceilingCents: Math.round(Number(price) * 100),
            equivalent,
            checkedAt: e.checkedAt,
          }
        : null,
      marketSource: e?.source,
      ...proposal,
    };
  });
  const manifest = {
    campaign: policy.campaign,
    createdAt: new Date().toISOString(),
    policy,
    anchors,
    results,
  };
  fs.writeFileSync(
    "private-data/pricing/" + policy.campaign + "-preview.json",
    JSON.stringify(manifest, null, 2),
  );
  const fields = [
    "planId",
    "destination",
    "variant",
    "dataGb",
    "days",
    "currentCents",
    "proposedCents",
    "status",
    "reason",
    "contributionBps",
    "coste_mayorista_usd",
  ];
  fs.writeFileSync(
    "private-data/pricing/" + policy.campaign + "-preview.csv",
    "\uFEFF" +
      [fields, ...results.map((r) => fields.map((k) => r[k] ?? ""))]
        .map((row) =>
          row.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(","),
        )
        .join("\r\n"),
  );
  console.log(
    JSON.stringify({
      campaign: policy.campaign,
      reviewed: results.length,
      eligible: results.filter((r) => r.status === "eligible").length,
      reasons: results.reduce(
        (acc, r) => ((acc[r.reason] = (acc[r.reason] ?? 0) + 1), acc),
        {},
      ),
      changes: results
        .filter((r) => r.status === "eligible")
        .map((r) => ({
          id: r.planId,
          from: r.currentCents,
          to: r.proposedCents,
          contributionBps: r.contributionBps,
        })),
    }),
  );
} catch {
  console.error(
    "Pricing workflow stopped. Check private configuration, source freshness and provider permissions. No credentials or wholesale values printed.",
  );
  process.exitCode = 1;
}
