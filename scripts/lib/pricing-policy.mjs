const integer = (value, min, max) =>
  Number.isSafeInteger(value) && value >= min && value <= max;
const ceil = (a, b) => (a + b - 1n) / b;

/** Pure proposal only. Never writes prices or treats missing evidence as permission. */
export function priceProposal(plan, config, now = Date.now()) {
  for (const [key, min, max] of [
    ["upliftBps", 0, 10000],
    ["minContributionBps", 0, 9999],
    ["lowPriceThresholdCents", 0, 100000000],
    ["maxLowPriceIncreaseBps", 0, 10000],
    ["maxEvidenceAgeMs", 1, 604800000],
  ])
    if (!integer(config[key], min, max)) throw Error("Invalid pricing policy");
  if (
    !integer(plan.baseCents, 1, 100000000) ||
    !integer(plan.anchorCents ?? plan.baseCents, 1, 100000000) ||
    !Number.isFinite(now)
  )
    throw Error("Invalid price identity");
  const hold = (reason) => ({
    status: "hold",
    reason,
    currentCents: plan.baseCents,
    proposedCents: plan.baseCents,
  });
  if (config.maxDiscountBps != null && !integer(config.maxDiscountBps, 0, 9999))
    throw Error("Invalid discount");
  if (
    !integer(config.affiliateBps, 0, 9999) ||
    !integer(config.feeBps, 0, 9999) ||
    !integer(config.fixedFeeCents, 0, 100000000) ||
    !integer(config.maxDiscountBps, 0, 9999) ||
    !integer(config.otherUnitCostUnits, 0, 1000000000000)
  )
    return hold("missing_cost_assumptions");
  const fresh = (time) =>
    Number.isFinite(time) &&
    time <= now + 300000 &&
    now - time <= config.maxEvidenceAgeMs;
  if (
    !integer(plan.wholesaleUnits, 1, 1000000000000) ||
    !fresh(plan.costCheckedAt)
  )
    return hold("stale_wholesale");
  const market = plan.market;
  if (
    !market ||
    market.equivalent !== true ||
    !integer(market.ceilingCents, 1, 100000000) ||
    !fresh(market.checkedAt)
  )
    return hold("market_unverified");
  const anchor = BigInt(plan.anchorCents ?? plan.baseCents);
  let target = ceil(anchor * BigInt(10000 + config.upliftBps), 1000000n) * 100n;
  const cap = BigInt(Math.floor(market.ceilingCents / 100) * 100);
  if (cap < BigInt(plan.baseCents)) return hold("market_below_current");
  if (target > cap) target = cap;
  if (target <= BigInt(plan.baseCents)) return hold("already_at_target");
  if (
    anchor <= BigInt(config.lowPriceThresholdCents) &&
    (target - anchor) * 10000n > anchor * BigInt(config.maxLowPriceIncreaseBps)
  )
    return hold("low_price_cap");
  // Discounts round revenue down; variable fees round up. Fixed fee allocated to one unit conservatively.
  const charged = (target * BigInt(10000 - config.maxDiscountBps)) / 10000n;
  const collectedUnits = charged * 100n;
  const feeUnits =
    ceil(collectedUnits * BigInt(config.feeBps + config.affiliateBps), 10000n) +
    BigInt(config.fixedFeeCents) * 100n;
  const contributionUnits =
    collectedUnits -
    feeUnits -
    BigInt(plan.wholesaleUnits) -
    BigInt(config.otherUnitCostUnits);
  if (
    collectedUnits === 0n ||
    contributionUnits * 10000n <
      collectedUnits * BigInt(config.minContributionBps)
  )
    return hold("contribution_below_floor");
  return {
    status: "eligible",
    reason: "all_controls_pass",
    currentCents: plan.baseCents,
    proposedCents: Number(target),
    chargedCents: Number(charged),
    contributionBps: Number((contributionUnits * 10000n) / collectedUnits),
  };
}
