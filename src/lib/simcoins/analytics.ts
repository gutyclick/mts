import { z } from "zod";

export const simcoinsClientEvents = [
  "simcoins_landing_view",
  "simcoins_join",
  "simcoins_checkout_redeem",
] as const;
export type SimcoinsClientEvent = (typeof simcoinsClientEvents)[number];
export const simcoinsClientEventSchema = z
  .object({ kind: z.enum(simcoinsClientEvents), nonce: z.uuid() })
  .strict();

export function simcoinsEventPathAllowed(
  kind: SimcoinsClientEvent,
  path: string,
) {
  return kind === "simcoins_checkout_redeem"
    ? /^\/(?:es\/(?:compra|checkout)|en\/checkout)\/?$/.test(path)
    : /^\/(es|en)\/simcoins\/?$/.test(path);
}
