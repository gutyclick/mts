import { yappyConfig } from "../integrations/yappy.ts";

export function retailYappySettings(
  env: Record<string, string | undefined>,
  live: boolean,
) {
  const config = yappyConfig(env, live, "retail");
  const bps = Number(env.YAPPY_RETAIL_FEE_BPS);
  const fixed = Number(env.YAPPY_RETAIL_FIXED_CENTS);
  if (
    !config ||
    env.YAPPY_RETAIL_ENABLED !== "true" ||
    env.YAPPY_RETAIL_PERSISTENCE_READY !== "true" ||
    env.YAPPY_RETAIL_FEES_CONFIRMED !== "true" ||
    !/^\d+$/.test(env.YAPPY_RETAIL_FEE_BPS ?? "") ||
    !/^\d+$/.test(env.YAPPY_RETAIL_FIXED_CENTS ?? "") ||
    !Number.isSafeInteger(bps) ||
    bps < 0 ||
    bps > 5000 ||
    !Number.isSafeInteger(fixed) ||
    fixed < 0 ||
    fixed > 10000
  )
    return null;
  return { config, feeBps: bps, fixedCents: fixed };
}

/** USD cents and 1/10000 USD costs. Discount/redemption already reduce cash. */
export function yappyContribution(
  cashCents: number,
  costUnits: number,
  feeBps: number,
  fixedCents: number,
) {
  for (const n of [cashCents, costUnits, feeBps, fixedCents])
    if (!Number.isSafeInteger(n) || n < 0)
      throw Error("Invalid Yappy financial input");
  if (cashCents < 1 || feeBps > 5000)
    throw Error("Invalid Yappy financial input");
  const cash = BigInt(cashCents),
    cost = BigInt(costUnits);
  const ceil = (n: bigint, d: bigint) => (n + d - 1n) / d;
  // Conservatively reserve affiliate 8% and maximum reward 6%, including guests.
  const fees =
    (ceil(cash * BigInt(feeBps), 10000n) + BigInt(fixedCents)) * 100n;
  const reserves =
    (ceil(cash * 800n, 10000n) + ceil(cash * 600n, 10000n)) * 100n;
  const net = cash * 100n - cost - fees - reserves;
  return {
    eligible: net * 10000n >= cash * 100n * 2000n,
    contributionUnits: Number(net),
  };
}
