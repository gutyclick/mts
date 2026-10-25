import { z } from "zod";

export const CART_STORAGE_KEY = "mytripsim.cart.v1";
export const cartLineSchema = z
  .object({
    destination: z
      .string()
      .min(1)
      .max(80)
      .regex(/^[a-z0-9-]+$/),
    planId: z.string().min(1).max(128),
    quantity: z.number().int().min(1).max(10),
  })
  .strict();
export const cartSchema = z
  .array(cartLineSchema)
  .max(20)
  .refine(
    (lines) => new Set(lines.map(cartKey)).size === lines.length,
    "Duplicate cart references",
  );
export type CartLine = z.infer<typeof cartLineSchema>;
export type CartItem = CartLine & {
  name: { es: string; en: string };
  countryCode: string;
  regional: boolean;
  dataGb: number;
  allowance: string;
  days: number;
  network: string;
  planName: string;
  retailPriceCents?: number;
};
export type ResolvedCart = { items: CartItem[]; unavailable: CartLine[] };
export function cartTotal(cart: ResolvedCart): number | null {
  if (
    !cart.items.length ||
    cart.unavailable.length ||
    cart.items.some((item) => item.retailPriceCents == null)
  )
    return null;
  return cart.items.reduce(
    (sum, item) => sum + item.retailPriceCents! * item.quantity,
    0,
  );
}
export function cartKey(line: Pick<CartLine, "destination" | "planId">) {
  return `${line.destination}:${line.planId}`;
}
export function readCart(value: string | null): CartLine[] {
  try {
    const parsed = cartSchema.safeParse(JSON.parse(value ?? "[]"));
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}
export function addCartLine(lines: CartLine[], line: CartLine): CartLine[] {
  const existing = lines.find((item) => cartKey(item) === cartKey(line));
  if (existing)
    return lines.map((item) =>
      cartKey(item) === cartKey(line)
        ? { ...item, quantity: Math.min(10, item.quantity + line.quantity) }
        : item,
    );
  return lines.length < 20 ? [...lines, line] : lines;
}
