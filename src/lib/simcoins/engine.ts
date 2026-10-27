import { defaultSimcoinsLevels, defaultSimcoinsSettings } from "./config.ts";
import type {
  SimcoinsLevel,
  SimcoinsQuote,
  SimcoinsQuoteLine,
  SimcoinsSettings,
  SimcoinsUnitSnapshot,
} from "./model.ts";
const B = 10000n;
const ceil = (a: bigint, b: bigint) => (a + b - 1n) / b;
function whole(n: number, min = 0, max = 999999999999) {
  if (!Number.isSafeInteger(n) || n < min || n > max)
    throw Error("Invalid SimCoins integer");
  return BigInt(n);
}
const safe = (n: bigint) => {
  const result = Number(n);
  if (!Number.isSafeInteger(result)) throw Error("SimCoins amount overflow");
  return result;
};
export function earnedCoins(cents: number, rateBps: number) {
  return safe((whole(cents) * whole(rateBps, 0, 10000)) / B);
}
export function usdStringToCents(input: string) {
  if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(input)) throw Error("Invalid USD amount");
  const [a, b = ""] = input.split(".");
  return safe(BigInt(a) * 100n + BigInt(b.padEnd(2, "0")));
}
export function levelForSpend(
  cents: number,
  levels: SimcoinsLevel[] = defaultSimcoinsLevels,
) {
  whole(cents);
  if (!levels.length) throw Error("Missing SimCoins levels");
  let last = -1;
  const ids = new Set();
  for (const level of levels) {
    whole(level.thresholdCents);
    whole(level.rateBps, 0, 10000);
    if (level.thresholdCents <= last || ids.has(level.id))
      throw Error("Invalid SimCoins levels");
    ids.add(level.id);
    last = level.thresholdCents;
  }
  return (
    [...levels].reverse().find((l) => cents >= l.thresholdCents) ?? levels[0]
  );
}
export function proportionalRefundCoins(
  original: number,
  refunded: number,
  paid: number,
) {
  return safe((whole(original) * whole(refunded, 0, paid)) / whole(paid, 1));
}
export function allocateSimcoins(total: number, weights: number[]) {
  const all = weights.map((n) => whole(n)),
    denominator = all.reduce((a, b) => a + b, 0n);
  whole(total);
  if (!denominator) {
    if (total) throw Error("Missing reward weights");
    return all.map(() => 0);
  }
  const t = BigInt(total),
    allocated = all.map((w) => (t * w) / denominator);
  let remaining = t - allocated.reduce((a, b) => a + b, 0n);
  const order = all
    .map((w, i) => ({ i, remainder: (t * w) % denominator }))
    .sort((a, b) =>
      a.remainder === b.remainder
        ? a.i - b.i
        : a.remainder > b.remainder
          ? -1
          : 1,
    );
  for (const item of order) {
    if (!remaining) break;
    allocated[item.i]++;
    remaining--;
  }
  return allocated.map(safe);
}
type Input = {
  lines: SimcoinsQuoteLine[];
  currency: string;
  fxRate?: string;
  currencyDecimals?: number;
  availableCoins: number;
  requestedCoins: number;
  eligibleSpendCents: number;
  settings?: SimcoinsSettings;
  levels?: SimcoinsLevel[];
  nowMs?: number;
};
export function buildSimcoinsQuote(input: Input): SimcoinsQuote {
  const settings = input.settings ?? defaultSimcoinsSettings,
    levels = input.levels ?? defaultSimcoinsLevels,
    now = input.nowMs ?? Date.now();
  for (const [key, value] of Object.entries(settings))
    whole(value, 0, key.endsWith("Bps") ? 10000 : 999999999999);
  if (settings.coinsPerUsd !== 100 || settings.costsMaxAgeSeconds < 1)
    throw Error("Invalid SimCoins conversion or freshness");
  whole(input.availableCoins);
  whole(input.requestedCoins);
  const level = levelForSpend(input.eligibleSpendCents, levels);
  if (
    !/^[A-Z]{3}$/.test(input.currency) ||
    !Number.isFinite(now) ||
    input.lines.length < 1 ||
    input.lines.length > 20 ||
    new Set(input.lines.map((l) => l.planId)).size !== input.lines.length
  )
    throw Error("Invalid SimCoins cart");
  const lines = [...input.lines].sort((a, b) =>
    a.planId < b.planId ? -1 : a.planId > b.planId ? 1 : 0,
  );
  for (const l of lines) {
    if (!/^[A-Za-z0-9_.-]{1,200}$/.test(l.planId))
      throw Error("Invalid plan identity");
    whole(l.quantity, 1, 10);
    whole(l.grossUnitCents, 1, 99999999);
    whole(l.taxUnitCents ?? 0, 0, l.grossUnitCents);
    whole(
      l.promotionUnitCents ?? 0,
      0,
      l.grossUnitCents - (l.taxUnitCents ?? 0),
    );
    if (l.wholesaleUnitUnits !== null) whole(l.wholesaleUnitUnits, 1);
  }
  const n = lines.reduce((s, l) => s + l.quantity, 0),
    gross = lines.reduce((s, l) => s + l.grossUnitCents * l.quantity, 0);
  whole(gross, 1, 99999999);
  const fxValid =
    input.currency === "USD" ||
    (typeof input.fxRate === "string" &&
      /^\d{1,16}$/.test(input.fxRate) &&
      BigInt(input.fxRate) > 0n &&
      [0, 2].includes(input.currencyDecimals ?? -1));
  const fxRate =
      input.currency === "USD" ? "10000000000" : fxValid ? input.fxRate! : "0",
    currencyDecimals =
      input.currency === "USD" ? 2 : (input.currencyDecimals ?? 2);
  const paid = (cash: number) => {
    if (input.currency === "USD") return cash;
    if (!fxValid) return 0;
    const rate = BigInt(fxRate),
      factor = 10n ** BigInt(currencyDecimals),
      den = 100n * 10000000000n,
      minor = (BigInt(cash) * rate * factor + den / 2n) / den;
    return Math.min(cash, safe((minor * den) / (rate * factor)));
  };
  const stripeBps =
    input.currency === "USD" ? settings.stripeBps : settings.stripeFxBps;
  const expanded = lines.flatMap((l) =>
    Array.from({ length: l.quantity }, (_, i) => ({
      line: l,
      unitIndex: i + 1,
    })),
  );
  const fixed = expanded.map(
    (_, i) =>
      Math.floor(settings.fixedFeeUnits / n) +
      (i < settings.fixedFeeUnits % n ? 1 : 0),
  );
  const fresh =
    fxValid &&
    lines.every(
      (l) =>
        l.wholesaleUnitUnits !== null &&
        l.costObservedAt !== null &&
        Number.isFinite(Date.parse(l.costObservedAt)) &&
        Date.parse(l.costObservedAt) <= now + 30000 &&
        now - Date.parse(l.costObservedAt) <=
          settings.costsMaxAgeSeconds * 1000,
    );
  const promotion = lines.some((l) => (l.promotionUnitCents ?? 0) > 0);
  const promotionValid = lines.every(
    (l) =>
      BigInt(l.promotionUnitCents ?? 0) * B <=
      BigInt(l.grossUnitCents - (l.taxUnitCents ?? 0)) *
        BigInt(settings.maxPromotionBps),
  );
  const fee = (cash: number, feeShare: number) =>
    ceil(BigInt(cash) * 100n * BigInt(stripeBps), B) +
    ceil(BigInt(cash) * 100n * BigInt(settings.affiliateBps), B) +
    BigInt(feeShare) +
    BigInt(settings.otherVariableUnits);
  const contribution = (
    cash: number,
    tax: number,
    cost: number,
    coins: number,
    share: number,
  ) =>
    BigInt(paid(cash)) * 100n -
    BigInt(tax) * 100n -
    BigInt(cost) -
    fee(cash, share) -
    BigInt(coins) * 100n;
  const meets = (
    cash: number,
    tax: number,
    cost: number,
    coins: number,
    share: number,
  ) =>
    cash > 0 &&
    contribution(cash, tax, cost, coins, share) * B >=
      BigInt(paid(cash)) * 100n * BigInt(settings.minContributionBps);
  const baseEarn = new Map(
    lines.map((l) => [
      l.planId,
      fresh &&
        promotionValid &&
        l.earnEnabled &&
        expanded.every(
          (u, i) =>
            u.line.planId !== l.planId ||
            meets(
              l.grossUnitCents - (l.promotionUnitCents ?? 0),
              l.taxUnitCents ?? 0,
              l.wholesaleUnitUnits ?? 0,
              safe(
                ceil(
                  BigInt(
                    Math.max(
                      0,
                      paid(l.grossUnitCents - (l.promotionUnitCents ?? 0)) -
                        (l.taxUnitCents ?? 0),
                    ),
                  ) * BigInt(level.rateBps),
                  B,
                ),
              ),
              fixed[i],
            ),
        ),
    ]),
  );
  const unitCap = new Map<string, number>();
  for (const l of lines) {
    let lo = 0,
      hi =
        fresh && promotionValid && !promotion && l.redeemEnabled
          ? earnedCoins(
              Math.max(0, paid(l.grossUnitCents) - (l.taxUnitCents ?? 0)),
              settings.maxRedeemBps,
            )
          : 0;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2),
        cash = l.grossUnitCents - (l.promotionUnitCents ?? 0) - mid,
        coins = baseEarn.get(l.planId)
          ? safe(
              ceil(
                BigInt(Math.max(0, paid(cash) - (l.taxUnitCents ?? 0))) *
                  BigInt(level.rateBps),
                B,
              ),
            )
          : 0;
      const valid = expanded.every(
        (u, i) =>
          u.line.planId !== l.planId ||
          meets(
            cash,
            l.taxUnitCents ?? 0,
            l.wholesaleUnitUnits ?? 0,
            coins,
            fixed[i],
          ),
      );
      if (valid) lo = mid;
      else hi = mid - 1;
    }
    unitCap.set(l.planId, lo);
  }
  function evaluate(budget: number, disabled = false) {
    let remaining = budget;
    const discounts = new Map<string, number>();
    for (const l of lines) {
      const amount = disabled
        ? 0
        : Math.min(
            unitCap.get(l.planId) ?? 0,
            Math.floor(remaining / l.quantity),
          );
      discounts.set(l.planId, amount);
      remaining -= amount * l.quantity;
    }
    const units: SimcoinsUnitSnapshot[] = expanded.map((u, i) => {
      const l = u.line,
        discount = discounts.get(l.planId) ?? 0,
        net = l.grossUnitCents - (l.promotionUnitCents ?? 0) - discount,
        eligible = !disabled && !!baseEarn.get(l.planId);
      return {
        planId: l.planId,
        unitIndex: u.unitIndex,
        grossCents: l.grossUnitCents,
        netCents: net,
        paidCents: paid(net),
        taxCents: l.taxUnitCents ?? 0,
        promotionCents: l.promotionUnitCents ?? 0,
        redeemedCoins: discount,
        earnedCoins: 0,
        eligibleSpendCents: eligible
          ? Math.max(0, paid(net) - (l.taxUnitCents ?? 0))
          : 0,
        wholesaleUnits: l.wholesaleUnitUnits ?? 0,
        fixedFeeUnits: fixed[i],
        earnEligible: eligible,
        reason: eligible
          ? null
          : !fxValid
            ? "unverified_fx"
            : !fresh
              ? "unverified_cost"
              : !promotionValid
                ? "promotion_restricted"
                : !l.earnEnabled
                  ? "product_ineligible"
                  : "insufficient_contribution",
      };
    });
    const earnTotal = earnedCoins(
        units.reduce((s, u) => s + u.eligibleSpendCents, 0),
        level.rateBps,
      ),
      allocations = allocateSimcoins(
        earnTotal,
        units.map((u) => u.eligibleSpendCents),
      );
    units.forEach((u, i) => (u.earnedCoins = allocations[i]));
    const net = units.reduce((s, u) => s + u.netCents, 0),
      margin = units.reduce(
        (s, u) =>
          s +
          contribution(
            u.netCents,
            u.taxCents,
            u.wholesaleUnits,
            u.earnedCoins,
            u.fixedFeeUnits,
          ),
        0n,
      );
    const valid =
      fresh &&
      margin * B >=
        BigInt(units.reduce((s, u) => s + u.paidCents, 0)) *
          100n *
          BigInt(settings.minContributionBps) &&
      units.every(
        (u) =>
          (!u.earnEligible && !u.redeemedCoins) ||
          meets(
            u.netCents,
            u.taxCents,
            u.wholesaleUnits,
            u.earnedCoins,
            u.fixedFeeUnits,
          ),
      );
    return {
      units,
      net,
      margin,
      valid,
      earned: earnTotal,
      redeemed: units.reduce((s, u) => s + u.redeemedCoins, 0),
      spend: units.reduce((s, u) => s + u.eligibleSpendCents, 0),
    };
  }
  let lo = 0,
    hi = Math.min(
      input.availableCoins,
      lines.reduce((s, l) => s + (unitCap.get(l.planId) ?? 0) * l.quantity, 0),
    );
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (evaluate(mid).valid) lo = mid;
    else hi = mid - 1;
  }
  const maximum = evaluate(lo),
    base = evaluate(0),
    disabled = !base.valid;
  const result = evaluate(
    Math.min(
      input.requestedCoins,
      input.availableCoins,
      disabled ? 0 : maximum.redeemed,
    ),
    disabled,
  );
  const maxRedeemCoins = disabled ? 0 : maximum.redeemed;
  const reason = !fxValid
    ? "unverified_fx"
    : !fresh
      ? "unverified_cost"
      : !promotionValid
        ? "promotion_restricted"
        : disabled
          ? "insufficient_contribution"
          : result.units.some((u) => u.earnEligible) || result.redeemed
            ? null
            : promotion
              ? "promotion_excludes_redemption"
              : "product_ineligible";
  return {
    version: 1,
    policyVersion: settings.policyVersion,
    levelId: level.id,
    rateBps: level.rateBps,
    currency: input.currency,
    fxRate,
    currencyDecimals,
    grossCents: gross,
    netCents: result.net,
    taxCents: result.units.reduce((s, u) => s + u.taxCents, 0),
    promoCents: result.units.reduce((s, u) => s + u.promotionCents, 0),
    redeemedCoins: result.redeemed,
    earnedCoins: result.earned,
    eligibleSpendCents: result.spend,
    maxRedeemCoins,
    contributionUnits: safe(result.margin),
    reason,
    units: result.units,
    lines: lines.map((l) => {
      const units = result.units.filter((u) => u.planId === l.planId);
      return {
        planId: l.planId,
        quantity: l.quantity,
        grossUnitCents: l.grossUnitCents,
        netUnitCents: units[0].netCents,
        redeemUnitCoins: units[0].redeemedCoins,
        earnedCoins: units.reduce((s, u) => s + u.earnedCoins, 0),
        eligibleSpendCents: units.reduce((s, u) => s + u.eligibleSpendCents, 0),
        wholesaleUnitUnits: l.wholesaleUnitUnits ?? 0,
        earnEligible: units.every((u) => u.earnEligible),
        redeemEligible: !disabled && (unitCap.get(l.planId) ?? 0) > 0,
        reason: units.find((u) => u.reason)?.reason ?? null,
      };
    }),
  };
}
