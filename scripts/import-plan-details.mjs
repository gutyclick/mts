import { readFile, writeFile, copyFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { buildPlanDetails } from "./plan-detail-parser.mjs";
import { format } from "prettier";

const source = process.argv[2];
if (!source)
  throw new Error("Usage: npm run import:details -- <private-provider-csv>");
const rows = parse(await readFile(source, "utf8"), {
  columns: true,
  bom: true,
  skip_empty_lines: true,
});
const catalog = JSON.parse(await readFile("src/data/plans.json", "utf8"));
const destinations = JSON.parse(
  await readFile("src/data/destinations.json", "utf8"),
);
const { details, summary } = buildPlanDetails(catalog, rows, destinations);
const codes = [
  ...new Set(Object.values(details).flatMap((detail) => detail.coverage)),
];
for (const code of codes)
  await copyFile(
    new URL(
      `../node_modules/circle-flags/flags/${code.toLowerCase()}.svg`,
      import.meta.url,
    ),
    `public/flags/${code.toLowerCase()}.svg`,
  );
await writeFile(
  "src/data/plan-details.json",
  await format(JSON.stringify(details), { parser: "json" }),
);
await writeFile(
  "src/data/plan-details-summary.json",
  await format(JSON.stringify(summary), { parser: "json" }),
);
console.log(JSON.stringify(summary));
