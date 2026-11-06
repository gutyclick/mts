const B = 10000n;
const ceil = (n, d) => (n + d - 1n) / d;
function integer(n, min = 0) {
  if (!Number.isSafeInteger(n) || n < min) throw Error("Invalid audit amount");
  return BigInt(n);
}
/** Price/cash: USD cents; wholesale/reserves: 1/10000 USD; rates: basis points.
 * One unit per order. Redemption reduces cash once; never charge it twice as cost.
 * Percentage fees round UP to cents; earned coins round DOWN (1 coin = 1 USD cent).
 */
export function auditContribution(priceCents, costUnits, scenario) {
  const price = integer(priceCents, 1),
    cost = integer(costUnits);
  const discount = integer(scenario.discountBps ?? 0),
    redemption = integer(scenario.redeemBps ?? 0);
  const feeRate = integer(scenario.feeBps),
    affiliate = integer(scenario.affiliateBps ?? 0),
    earn = integer(scenario.earnBps ?? 0);
  if (
    discount > B ||
    redemption > B ||
    feeRate > B ||
    affiliate > B ||
    earn > B ||
    (discount && redemption)
  )
    throw Error("Invalid or stacked audit promotion");
  const deduction = (price * (discount || redemption)) / B,
    cash = price - deduction;
  if (!cash)
    return {
      chargedCents: 0,
      contributionUnits: -Number(cost),
      marginBps: null,
      meetsFloor: false,
      loss: true,
    };
  const fee =
    ceil(cash * feeRate, B) * 100n +
    integer(scenario.fixedFeeUnits) +
    integer(scenario.radarUnits ?? 0) +
    integer(scenario.otherUnits ?? 0);
  const affiliateUnits = ceil(cash * affiliate, B) * 100n,
    coins = (cash * earn) / B;
  const contribution = cash * 100n - cost - fee - affiliateUnits - coins * 100n;
  const numerator = contribution * B,
    denominator = cash * 100n;
  const ratio =
    numerator >= 0n ? numerator / denominator : -ceil(-numerator, denominator);
  const minimum = integer(scenario.minContributionBps ?? 2000);
  const values = [cash, contribution, ratio, fee, affiliateUnits, coins];
  if (
    values.some(
      (n) =>
        n > BigInt(Number.MAX_SAFE_INTEGER) ||
        n < -BigInt(Number.MAX_SAFE_INTEGER),
    )
  )
    throw Error("Audit overflow");
  return {
    chargedCents: Number(cash),
    contributionUnits: Number(contribution),
    marginBps: Number(ratio),
    feeUnits: Number(fee),
    affiliateUnits: Number(affiliateUnits),
    earnedCoins: Number(coins),
    meetsFloor: numerator >= minimum * denominator,
    loss: contribution < 0n,
  };
}
/** Smallest whole-USD price meeting an explicitly selected scenario; not a published recommendation. */
export function minimumWholeUsd(costUnits, scenario) {
  let low = 1,
    high = 1;
  while (!auditContribution(high * 100, costUnits, scenario).meetsFloor) {
    high *= 2;
    if (high > 10000000) throw Error("No feasible audit price");
  }
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (auditContribution(mid * 100, costUnits, scenario).meetsFloor)
      high = mid;
    else low = mid + 1;
  }
  return low;
}
