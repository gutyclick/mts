import { z } from "zod";

const text = z.string().min(1).max(1000);
const detailSchema = z.object({
  dataGb: z.number().positive(),
  days: z.number().int().positive(),
  coverage: z.array(text),
  technologies: z.array(text),
  activation: z.enum(["network", "installation", "purchase"]),
  topUp: z.enum(["same-area-data", "none"]),
  networks: z.array(
    z.object({
      countryCode: text.optional(),
      countryName: text.optional(),
      operators: z.array(z.object({ name: text, technologies: z.array(text) })),
    }),
  ),
  apn: text.optional(),
  fairUse: text.optional(),
});

// Zod objects strip unlisted fields, including any accidental commercial fields.
export const planSchema = z
  .object({
    id: text.max(200),
    name: text.max(300),
    allowance: text.max(50),
    dataGb: z.number().positive().max(100000),
    days: z.number().int().positive().max(3650),
    kind: z.literal("fixed"),
    coverageCode: text.max(100),
    details: detailSchema.optional(),
  })
  .refine(
    (p) =>
      !p.details ||
      (p.details.dataGb === p.dataGb && p.details.days === p.days),
    {
      message: "Technical details do not match the plan identity",
    },
  );

export const destinationSchema = z.object({
  slug: text.regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  name: z.object({ es: text, en: text }),
  code: text.max(100),
  type: z.enum(["country", "region"]),
  aliases: z.array(text),
  planCount: z.number().int().positive(),
  dataMinGb: z.number().positive(),
  dataMaxGb: z.number().positive(),
  image: text
    .regex(
      /^\/(images\/|illustrations\/|flags\/)[^?#:%\\]+\.(png|jpg|jpeg|webp|avif|svg)$/i,
    )
    .refine(
      (v) => !v.includes("..") && ![...v].some((c) => c.charCodeAt(0) < 32),
    ),
  artworkKind: z.enum(["banner", "illustration", "flag"]),
});

export function parseDestinationRow(row: Record<string, unknown>) {
  return destinationSchema.parse({
    ...row,
    planCount: row.plan_count,
    dataMinGb: numeric(row.data_min_gb),
    dataMaxGb: numeric(row.data_max_gb),
    artworkKind: row.artwork_kind,
  });
}
export function parsePlanRow(row: Record<string, unknown>) {
  return planSchema.parse({
    ...row,
    dataGb: numeric(row.data_gb),
    coverageCode: row.coverage_code,
    details: row.details ?? undefined,
  });
}
function numeric(value: unknown) {
  return typeof value === "string" && /^\d+(\.\d+)?$/.test(value)
    ? Number(value)
    : value;
}
