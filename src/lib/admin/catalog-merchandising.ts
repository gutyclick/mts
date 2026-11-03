import { z } from "zod";
export const catalogPlanMerchandisingSchema = z
  .object({
    plan_id: z.string().min(1).max(200),
    visibility: z.enum(["auto", "show", "hide"]),
    commercial_category: z
      .enum(["basic", "essential", "plus", "max"])
      .nullable(),
    recommendation_eligible: z.boolean(),
    incident_block: z.boolean(),
    main_priority: z.number().int().min(1).max(100).nullable(),
  })
  .strict();
export const catalogDestinationMerchandisingSchema = z
  .object({
    destination_slug: z.string().min(1).max(200),
    approved_modalities: z
      .array(z.enum(["standard", "premium", "iij", "usip", "nonhkip", "myip"]))
      .min(1)
      .max(3)
      .refine((v) => new Set(v).size === v.length),
    approval_evidence: z.string().trim().min(10).max(2000),
  })
  .strict();
export const catalogMerchandisingRequestSchema = z.discriminatedUnion(
  "entity",
  [
    z
      .object({
        entity: z.literal("plan"),
        value: catalogPlanMerchandisingSchema,
      })
      .strict(),
    z
      .object({
        entity: z.literal("destination"),
        value: catalogDestinationMerchandisingSchema,
      })
      .strict(),
  ],
);
