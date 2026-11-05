/** Financial units are 1/10000 USD (100 units per cent). No consumer rewards apply. */
export type QuoteInput = {
  unitCents: number;
  quantity: number;
  taxCents: number;
  wholesaleUnitUnits: number;
  feeBps: number;
  fixedFeeCents: number;
  otherReserveCents?: number;
  minContributionBps?: number;
};

function integer(
  value: number,
  name: string,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): bigint {
  if (!Number.isSafeInteger(value) || value < min || value > max)
    throw new RangeError(`Invalid ${name}`);
  return BigInt(value);
}

function safe(value: bigint): number {
  if (
    value > BigInt(Number.MAX_SAFE_INTEGER) ||
    value < BigInt(Number.MIN_SAFE_INTEGER)
  )
    throw new RangeError("Quote exceeds safe integer range");
  return Number(value);
}

export function quoteTotals(input: QuoteInput) {
  const unit = integer(input.unitCents, "unitCents", 1);
  if (unit % 100n !== 0n) throw new RangeError("Price must be whole USD");
  const quantity = integer(input.quantity, "quantity", 1, 10000);
  const tax = integer(input.taxCents, "taxCents");
  const wholesale =
    integer(input.wholesaleUnitUnits, "wholesaleUnitUnits") * quantity;
  const rate = integer(input.feeBps, "feeBps", 0, 10000);
  const fixed = integer(input.fixedFeeCents, "fixedFeeCents");
  const reserve = integer(input.otherReserveCents ?? 0, "otherReserveCents");
  const minimum = integer(
    input.minContributionBps ?? 2000,
    "minContributionBps",
    0,
    10000,
  );
  const subtotal = unit * quantity;
  const total = subtotal + tax;
  const fee = (total * 100n * rate + 9999n) / 10000n + fixed * 100n;
  const revenue = subtotal * 100n;
  const contribution = revenue - fee - wholesale - reserve * 100n;
  // Floor negative ratios as well, so the displayed margin never overstates it.
  const numerator = contribution * 10000n;
  const bps =
    numerator >= 0n
      ? numerator / revenue
      : -((-numerator + revenue - 1n) / revenue);
  safe(revenue);
  safe(total * 100n);
  safe(reserve * 100n);
  return {
    subtotalCents: safe(subtotal),
    taxCents: safe(tax),
    totalCents: safe(total),
    feeUnits: safe(fee),
    wholesaleUnits: safe(wholesale),
    contributionUnits: safe(contribution),
    contributionBps: safe(bps),
    eligible: numerator >= minimum * revenue,
  };
}

export type ReleaseInput = {
  paymentStatus: string;
  orderStatus: string;
  readyUnits: number;
  totalUnits: number;
  refunded?: boolean;
};

/** Pure initial-release guard; callers must still authorize and atomically claim release. */
export function canRelease(input: ReleaseInput): boolean {
  return (
    input.paymentStatus === "paid" &&
    input.orderStatus === "awaiting_release" &&
    (input.refunded === undefined || input.refunded === false) &&
    Number.isSafeInteger(input.totalUnits) &&
    input.totalUnits > 0 &&
    input.totalUnits <= 10000 &&
    Number.isSafeInteger(input.readyUnits) &&
    input.readyUnits === 0
  );
}
