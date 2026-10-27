import { z } from "zod";
import { currencyCode } from "./currency.ts";
export const currencySchema = z
  .string()
  .refine((value) => currencyCode(value) !== null, "Invalid currency")
  .transform((value) => currencyCode(value)!);
