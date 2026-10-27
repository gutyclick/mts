export const currencies = [
  {
    code: "USD",
    symbol: "US$",
    decimals: 2,
    es: "Dólar estadounidense",
    en: "US dollar",
  },
  { code: "EUR", symbol: "€", decimals: 2, es: "Euro", en: "Euro" },
  {
    code: "GBP",
    symbol: "£",
    decimals: 2,
    es: "Libra esterlina",
    en: "British pound",
  },
  {
    code: "CAD",
    symbol: "CA$",
    decimals: 2,
    es: "Dólar canadiense",
    en: "Canadian dollar",
  },
  {
    code: "CHF",
    symbol: "CHF",
    decimals: 2,
    es: "Franco suizo",
    en: "Swiss franc",
  },
  {
    code: "AUD",
    symbol: "A$",
    decimals: 2,
    es: "Dólar australiano",
    en: "Australian dollar",
  },
  {
    code: "MXN",
    symbol: "MX$",
    decimals: 2,
    es: "Peso mexicano",
    en: "Mexican peso",
  },
  {
    code: "COP",
    symbol: "CO$",
    decimals: 2,
    es: "Peso colombiano",
    en: "Colombian peso",
  },
  {
    code: "ARS",
    symbol: "AR$",
    decimals: 2,
    es: "Peso argentino",
    en: "Argentine peso",
  },
  {
    code: "CLP",
    symbol: "CL$",
    decimals: 0,
    es: "Peso chileno",
    en: "Chilean peso",
  },
  {
    code: "DOP",
    symbol: "RD$",
    decimals: 2,
    es: "Peso dominicano",
    en: "Dominican peso",
  },
  {
    code: "UYU",
    symbol: "$U",
    decimals: 2,
    es: "Peso uruguayo",
    en: "Uruguayan peso",
  },
  {
    code: "BRL",
    symbol: "R$",
    decimals: 2,
    es: "Real brasileño",
    en: "Brazilian real",
  },
  {
    code: "KRW",
    symbol: "₩",
    decimals: 0,
    es: "Won surcoreano",
    en: "South Korean won",
  },
  {
    code: "CNY",
    symbol: "CN¥",
    decimals: 2,
    es: "Yuan chino",
    en: "Chinese yuan",
  },
  {
    code: "JPY",
    symbol: "¥",
    decimals: 0,
    es: "Yen japonés",
    en: "Japanese yen",
  },
  {
    code: "PEN",
    symbol: "S/",
    decimals: 2,
    es: "Sol peruano",
    en: "Peruvian sol",
  },
  {
    code: "DKK",
    symbol: "kr",
    decimals: 2,
    es: "Corona danesa",
    en: "Danish krone",
  },
] as const;
export type Currency = (typeof currencies)[number]["code"];
export const usdRate = "10000000000";
export function shouldFetchCurrencyQuote(currency:Currency,response:{currency:Currency;quote:{expiresAt:string|null}|null;error:boolean}|null,now=Date.now()){
 if(currency==='USD')return false;if(!response||response.currency!==currency)return true;if(response.error)return false;
 return !response.quote||!response.quote.expiresAt||new Date(response.quote.expiresAt).getTime()<=now;
}
export function currencyCode(value: unknown): Currency | null {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase();
  return currencies.some((c) => c.code === upper) ? (upper as Currency) : null;
}
const roundDiv = (numerator: bigint, denominator: bigint) =>
  (numerator + denominator / 2n) / denominator;
export function rateFromStripeBase(value: number) {
  if (!Number.isFinite(value) || value <= 0) throw Error("Invalid base rate");
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/.exec(String(value));
  if (!match) throw Error("Invalid rate");
  const digits = match[2] ?? "",
    exponent = Number(match[3] ?? 0) - digits.length;
  if (Math.abs(exponent) > 20) throw Error("Rate out of bounds");
  const numerator =
      BigInt(match[1] + digits) * (exponent > 0 ? 10n ** BigInt(exponent) : 1n),
    denominator = exponent < 0 ? 10n ** BigInt(-exponent) : 1n;
  const rate = roundDiv(BigInt(usdRate) * denominator, numerator);
  if (rate < 1n || rate > 1000000000000000n) throw Error("Rate out of bounds");
  return rate.toString();
}
export function convertUsdMinor(
  cents: number,
  currency: Currency,
  rate: string,
) {
  const definition = currencies.find((c) => c.code === currency);
  if (
    !definition ||
    !Number.isSafeInteger(cents) ||
    cents < 0 ||
    !/^\d{1,16}$/.test(rate) ||
    BigInt(rate) < 1n ||
    BigInt(rate) > 1000000000000000n
  )
    throw Error("Invalid conversion");
  if (currency === "USD" && rate !== usdRate)
    throw Error("USD rate must be one");
  const result = roundDiv(
    BigInt(cents) * BigInt(rate) * 10n ** BigInt(definition.decimals),
    100n * BigInt(usdRate),
  );
  if (result > 99999999n) throw Error("Converted amount out of bounds");
  return Number(result);
}
export function paymentCartTotal(
  items: { unit: number; quantity: number }[],
  currency: Currency,
  rate: string,
) {
  const total = items.reduce((sum, item) => {
    if (
      !Number.isInteger(item.quantity) ||
      item.quantity < 1 ||
      item.quantity > 10
    )
      throw Error("Invalid quantity");
    return sum + convertUsdMinor(item.unit, currency, rate) * item.quantity;
  }, 0);
  if (!Number.isSafeInteger(total) || total > 99999999)
    throw Error("Total out of bounds");
  return total;
}
export function formatMoney(
  amount: number,
  currency: Currency,
  locale: "es" | "en",
) {
  const definition = currencies.find((c) => c.code === currency);
  if (!definition || !Number.isSafeInteger(amount))
    throw Error("Invalid money");
  return new Intl.NumberFormat(locale === "es" ? "es-PA" : "en-US", {
    style: "currency",
    currency,
    currencyDisplay: "code",
    minimumFractionDigits: definition.decimals,
    maximumFractionDigits: definition.decimals,
  }).format(amount / 10 ** definition.decimals);
}
