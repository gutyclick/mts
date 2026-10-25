import { readFileSync, writeFileSync } from "node:fs";
import { parse } from "csv-parse/sync";
import { projectRetailPrices } from "../src/lib/retail-prices.ts";
const source = process.argv[2];
if (!source)
  throw new Error("Usage: npm run prices:import -- <private-final-prices.csv>");
const plans = Object.values(
  JSON.parse(readFileSync("src/data/plans.json", "utf8")),
).flat();
const rows = parse(readFileSync(source, "utf8"), {
  columns: true,
  bom: true,
  skip_empty_lines: true,
});
const prices = projectRetailPrices(rows, plans);
writeFileSync(
  "src/data/retail-prices.json",
  JSON.stringify(prices, null, 2) + "\n",
);
console.log(
  `Imported ${Object.keys(prices).length} final USD retail prices. Supplier costs, margins and other CSV columns were discarded.`,
);
