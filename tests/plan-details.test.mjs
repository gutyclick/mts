import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { buildPlanDetails } from "../scripts/plan-detail-parser.mjs";
const catalog = JSON.parse(readFileSync("src/data/plans.json", "utf8"));
const details = JSON.parse(readFileSync("src/data/plan-details.json", "utf8"));
const base = {
  id: "JP_0.5_7",
  name: "Japan 500MB 7Days",
  allowance: "500MB",
  dataGb: 0.5,
  days: 7,
  kind: "fixed",
  coverageCode: "JP",
};
const row = {
  Type: "Single",
  Slug: base.id,
  Name: base.name,
  "Data Type": "Data in Total",
  GBs: "0",
  Duration: "7",
  Coverage: "JP",
  "Billing starts": "First Installation",
  "Support TopUp Type": "Non-reloadable",
  Speed: "3G/4G/5G",
  "Operator Networks": "NTT docomo [5G]",
  APN: "vmobile.jp",
  "Price(USD)": "DO_NOT_EXPORT_COMMERCIAL",
  "Variant Price": "DO_NOT_EXPORT_COMMERCIAL",
  Validity: "180",
  ID: "PRIVATE_PROVIDER_ID",
  "Breakout IP": "HK",
  Instructions: "IGNORE THIS UNTRUSTED COLUMN",
};
test("enrichment projects public technical fields and preserves rounded MB plans", () => {
  const result = buildPlanDetails({ japan: [base] }, [row]);
  assert.equal(result.summary.roundedSubGbRows, 1);
  assert.equal(result.details[base.id].dataGb, 0.5);
  assert.equal(result.details[base.id].activation, "installation");
  assert.equal(result.details[base.id].topUp, "none");
  const encoded = JSON.stringify(result);
  for (const privateText of [
    "DO_NOT_EXPORT_COMMERCIAL",
    "PRIVATE_PROVIDER_ID",
    "UNTRUSTED COLUMN",
    "Validity",
    "Breakout IP",
  ])
    assert.ok(!encoded.includes(privateText));
  assert.deepEqual(
    Object.keys(result.details[base.id]).sort(),
    [
      "dataGb",
      "days",
      "coverage",
      "technologies",
      "activation",
      "topUp",
      "networks",
      "apn",
    ].sort(),
  );
});
test("identity checks reject duplicate, daily, incomplete and conflicting data before output", () => {
  const c = { japan: [base] };
  for (const rows of [
    [],
    [row, row],
    [{ ...row, "Data Type": "Daily Unlimited" }],
    [{ ...row, Duration: "30" }],
    [{ ...row, Name: "Japan 5GB 7Days" }],
    [{ ...row, Coverage: "US" }],
    [{ ...row, Speed: "unlimited" }],
    [{ ...row, GBs: "" }],
  ])
    assert.throws(() => buildPlanDetails(c, rows));
  assert.deepEqual(
    buildPlanDetails(c, [row, { ...row, Slug: "OTHER_DAILY" }]).summary
      .ignoredRows,
    1,
  );
});
test("regional parsing preserves nested country labels and operator-specific technologies", () => {
  const plan = { ...base, id: "AS_0.5_7", coverageCode: "AS" };
  const region = {
    ...row,
    Slug: plan.id,
    Type: "Multi-Area",
    Coverage: "HK,JP,TL,AN",
    "Operator Networks":
      "Hong Kong (China) (csl 4G, 3 5G), Japan (NTT docomo 5G), Timor-Leste (Telemor 4G), Netherlands Antilles (Chippie 4G)",
  };
  const result = buildPlanDetails({ asia: [plan] }, [region]).details[plan.id];
  assert.deepEqual(
    result.networks.map((g) => g.countryCode),
    ["HK", "JP", "TL", "AN"],
  );
  assert.deepEqual(result.networks[0].operators, [
    { name: "csl", technologies: ["4G"] },
    { name: "3", technologies: ["5G"] },
  ]);
});
test("all fixed products have complete allowlisted details, matching identity and local flags", () => {
  const plans = Object.values(catalog).flat();
  assert.equal(Object.keys(details).length, 1730);
  assert.deepEqual(Object.keys(details).sort(), plans.map((p) => p.id).sort());
  for (const plan of plans) {
    const d = details[plan.id];
    assert.equal(d.dataGb, plan.dataGb);
    assert.equal(d.days, plan.days);
    assert.ok(["network", "installation", "purchase"].includes(d.activation));
    for (const code of d.coverage)
      assert.ok(existsSync(`public/flags/${code.toLowerCase()}.svg`));
    for (const group of d.networks) {
      if (group.countryCode) assert.ok(d.coverage.includes(group.countryCode));
      assert.ok(group.operators.length);
    }
    for (const key of Object.keys(d))
      assert.ok(
        [
          "dataGb",
          "days",
          "coverage",
          "technologies",
          "activation",
          "topUp",
          "networks",
          "apn",
          "fairUse",
        ].includes(key),
      );
    for (const group of d.networks)
      for (const key of Object.keys(group))
        assert.ok(["countryCode", "countryName", "operators"].includes(key));
  }
  assert.ok(!/[$€£]|\bUSD\b/.test(JSON.stringify(details)));
  assert.deepEqual(
    details.JP_1_7_IIJ.networks[0].operators.map((o) => o.name),
    ["NTT docomo"],
  );
  assert.equal(details.JP_1_7_IIJ.apn, "vmobile.jp");
  assert.equal(details.CA_75_30.fairUse, "128 Kbps");
});
