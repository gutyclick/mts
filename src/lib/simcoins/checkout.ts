import { z } from "zod";
import { cartSchema, type CartLine } from "../cart.ts";
import { currencies, paymentCartTotal, type Currency } from "../currency.ts";

export const simcoinsQuoteRequestSchema = z
  .object({
    lines: cartSchema.refine((lines) => lines.length > 0),
    currency: z.enum(currencies.map((currency) => currency.code)),
    fxQuoteId: z.uuid().nullable(),
    useCoins: z.boolean(),
  })
  .strict()
  .refine((value) =>
    value.currency === "USD"
      ? value.fxQuoteId === null
      : value.fxQuoteId !== null,
  );

export function canonicalSimcoinsCart(lines: CartLine[]) {
  return JSON.stringify(
    [...lines]
      .sort((a, b) => a.planId.localeCompare(b.planId))
      .map(({ destination, planId, quantity }) => ({
        destination,
        planId,
        quantity,
      })),
  );
}

export function simcoinsPaymentTotal(
  lines: { netUnitCents: number; quantity: number }[],
  currency: Currency,
  rate: string,
) {
  return paymentCartTotal(
    lines.map((line) => ({ unit: line.netUnitCents, quantity: line.quantity })),
    currency,
    rate,
  );
}

export type SimcoinsCheckoutQuote = {
  id: string;
  expiresAt: string;
  currency: Currency;
  paymentTotal: number;
  earnedCoins: number;
  redeemedCoins: number;
  maxRedeemCoins: number;
  reasons: string[];
  firstPurchase?: boolean;
};
