const clean = (value = "") => String(value).trim().replace(/\s+/g, " ");
const key = (value) =>
  clean(value)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const activationRules = {
  "First Network Connection": "network",
  "First Installation": "installation",
  "After Purchase": "purchase",
};
const topUpRules = {
  "Data Reloadable for same area within validitity": "same-area-data",
  "Non-reloadable": "none",
};

export function splitNetworkGroups(value) {
  const result = [];
  let depth = 0,
    start = 0;
  for (let i = 0; i < value.length; i++) {
    if (value[i] === "(") depth++;
    if (value[i] === ")") depth--;
    if (depth < 0) throw new Error("Unbalanced operator groups");
    if (value[i] === "," && depth === 0) {
      result.push(clean(value.slice(start, i)));
      start = i + 1;
    }
  }
  if (depth) throw new Error("Unbalanced operator groups");
  result.push(clean(value.slice(start)));
  return result.filter(Boolean);
}
function parseOperators(value) {
  return value
    .split(",")
    .map(clean)
    .filter(Boolean)
    .map((text) => {
      const match =
        /^(.*?)\s*(?:\[([345]G(?:\/[345]G)*)\]|([345]G(?:\/[345]G)*))$/.exec(
          text,
        );
      return {
        name: match ? clean(match[1]) : text,
        technologies: match ? (match[2] || match[3]).split("/") : [],
      };
    });
}
function countryLookup(destinations) {
  const lookup = new Map();
  const display = new Intl.DisplayNames(["en"], { type: "region" });
  for (const a of "ABCDEFGHIJKLMNOPQRSTUVWXYZ")
    for (const b of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      const code = a + b,
        label = display.of(code);
      if (label && label !== code) lookup.set(key(label), code);
    }
  for (const d of destinations.filter((d) => d.type === "country"))
    for (const name of [d.name.en, ...d.aliases]) lookup.set(key(name), d.code);
  for (const [label, code] of Object.entries({
    "China mainland": "CN",
    "Hong Kong (China)": "HK",
    "Macao (China)": "MO",
    "Taiwan (China)": "TW",
    "South Korea": "KR",
    Turkey: "TR",
    "Czech Republic": "CZ",
    Russia: "RU",
    "Timor-Leste": "TL",
    "Netherlands Antilles": "AN",
  }))
    lookup.set(key(label), code);
  return lookup;
}
export function buildPlanDetails(catalog, rows, destinations = []) {
  const plans = new Map(
    Object.values(catalog)
      .flat()
      .map((plan) => [plan.id, plan]),
  );
  const lookup = countryLookup(destinations);
  const details = {},
    seen = new Set();
  let roundedSubGbRows = 0;
  for (const row of rows) {
    const plan = plans.get(row.Slug);
    if (!plan) continue; // Never introduces new or daily products.
    if (seen.has(plan.id))
      throw new Error(`Duplicate detail identity: ${plan.id}`);
    seen.add(plan.id);
    const nameData = /(\d+(?:\.\d+)?)\s*(GB|MB)/i.exec(row.Name || "");
    const gb = nameData
      ? Number(nameData[1]) / (nameData[2].toUpperCase() === "MB" ? 1000 : 1)
      : NaN;
    if (
      row["Data Type"] !== "Data in Total" ||
      gb !== plan.dataGb ||
      Number(row.Duration) !== plan.days
    )
      throw new Error(`Conflicting plan identity: ${plan.id}`);
    if (Number(row.GBs) !== plan.dataGb) {
      if (!(plan.dataGb < 1 && clean(row.GBs) === "0"))
        throw new Error(`Conflicting data allowance: ${plan.id}`);
      roundedSubGbRows++;
    }
    const coverage = [
      ...new Set(
        clean(row.Coverage)
          .split(",")
          .map((code) => code.trim()),
      ),
    ];
    if (
      !["Single", "Multi-Area"].includes(row.Type) ||
      (row.Type === "Single" &&
        (coverage.length !== 1 || coverage[0] !== plan.coverageCode))
    )
      throw new Error(`Conflicting coverage identity: ${plan.id}`);
    if (!coverage.length || coverage.some((code) => !/^[A-Z]{2}$/.test(code)))
      throw new Error(`Invalid coverage: ${plan.id}`);
    const activation = activationRules[row["Billing starts"]],
      topUp = topUpRules[row["Support TopUp Type"]];
    const technologies = clean(row.Speed).split("/");
    if (!activation || !topUp || technologies.some((t) => !/^[345]G$/.test(t)))
      throw new Error(`Unknown plan policy: ${plan.id}`);
    const rawNetworks = clean(row["Operator Networks"]);
    if (!rawNetworks) throw new Error(`Missing operators: ${plan.id}`);
    const networks =
      row.Type === "Single"
        ? [{ countryCode: coverage[0], operators: parseOperators(rawNetworks) }]
        : splitNetworkGroups(rawNetworks).map((group) => {
            const match = /^(.*)\(([^()]*)\)\s*$/.exec(group);
            if (!match)
              throw new Error(
                `Unrecognized regional network group: ${plan.id}`,
              );
            const countryName = clean(match[1]),
              countryCode = lookup.get(key(countryName));
            return {
              ...(countryCode ? { countryCode } : { countryName }),
              operators: parseOperators(match[2]),
            };
          });
    if (
      networks.some(
        (group) =>
          !group.operators.length ||
          group.operators.some((operator) => !operator.name),
      )
    )
      throw new Error(`Invalid operators: ${plan.id}`);
    if (
      networks.some(
        (group) => group.countryCode && !coverage.includes(group.countryCode),
      )
    )
      throw new Error(`Operator outside declared coverage: ${plan.id}`);
    const apn = clean(row.APN),
      fairUse = clean(row["FUP policy"]);
    if (apn && !/^[a-z0-9._-]+$/i.test(apn))
      throw new Error(`Invalid APN: ${plan.id}`);
    if (fairUse && !/^\d+(?:\.\d+)?\s*[KM]bps$/i.test(fairUse))
      throw new Error(`Unknown fair use policy: ${plan.id}`);
    // Explicit projection only. No prices, supplier IDs, IPs, validity ambiguity or arbitrary columns.
    details[plan.id] = {
      dataGb: plan.dataGb,
      days: plan.days,
      coverage,
      technologies,
      activation,
      topUp,
      networks,
      ...(apn ? { apn } : {}),
      ...(fairUse ? { fairUse } : {}),
    };
  }
  if (seen.size !== plans.size)
    throw new Error(
      `Incomplete details: ${plans.size - seen.size} catalog plans missing`,
    );
  return {
    details,
    summary: {
      matchedPlans: seen.size,
      ignoredRows: rows.length - seen.size,
      roundedSubGbRows,
      networkTechnologyDifferences: Object.values(details).filter((d) =>
        d.networks.some((group) =>
          group.operators.some((operator) =>
            operator.technologies.some((t) => !d.technologies.includes(t)),
          ),
        ),
      ).length,
      legacyCoverageCodes: [
        ...new Set(
          Object.values(details).flatMap((d) =>
            d.coverage.filter((code) => code === "AN"),
          ),
        ),
      ],
      activationRules: Object.fromEntries(
        ["network", "installation", "purchase"].map((rule) => [
          rule,
          Object.values(details).filter((d) => d.activation === rule).length,
        ]),
      ),
    },
  };
}
