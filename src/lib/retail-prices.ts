export function retailCents(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim()))
    throw new Error("Invalid final USD price");
  const [whole, decimal = ""] = value.trim().split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > 100000000)
    throw new Error("Final USD price out of range");
  return cents;
}
export function formatUSD(cents: number, locale: "es" | "en") {
  return new Intl.NumberFormat(locale === "es" ? "es-PA" : "en-US", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "code",
  }).format(cents / 100);
}
export function projectRetailPrices(
  rows: Record<string, string>[],
  expected: { id: string; dataGb: number; days: number }[],
) {
  const catalog = new Map(expected.map((plan) => [plan.id, plan]));
  const prices: Record<string, number> = {};
  for (const row of rows) {
    const id = row["ID del plan"]?.trim();
    const plan = catalog.get(id);
    if (
      !plan ||
      Object.hasOwn(prices, id) ||
      Number(row["Datos (GB)"]) !== plan.dataGb ||
      Number(row["Duración (días)"]) !== plan.days
    )
      throw new Error("CSV plan identity mismatch");
    prices[id] = retailCents(row["Precio final (USD)"] ?? "");
  }
  if (Object.keys(prices).length !== catalog.size)
    throw new Error("CSV must contain every published plan exactly once");
  return prices;
}
