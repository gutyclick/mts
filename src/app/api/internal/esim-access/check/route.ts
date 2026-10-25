import { createHash, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { esimAccess } from "@/lib/integrations/esimaccess-server";
import { EsimAccessError } from "@/lib/integrations/esimaccess-api";
import { compareProviderCatalog } from "@/lib/integrations/esimaccess-catalog";
import { catalogConfig } from "@/lib/supabase/catalog-api";

export const maxDuration = 30;
export async function POST(request: Request) {
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Robots-Tag": "noindex, nofollow",
  };
  const expected = process.env.ESIM_ACCESS_SYNC_SECRET?.trim();
  const authorization = request.headers.get("authorization") ?? "";
  if (
    !expected ||
    expected.length < 32 ||
    authorization.length > 1024 ||
    !timingSafeEqual(
      createHash("sha256").update(authorization).digest(),
      createHash("sha256").update(`Bearer ${expected}`).digest(),
    )
  )
    return Response.json({ error: "unauthorized" }, { status: 401, headers });
  try {
    const config = catalogConfig(process.env);
    if (!config) throw new EsimAccessError("configuration");
    const packages = await esimAccess().listFixedPackages();
    const client = createClient(config.url, config.key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const schema = z.array(
      z.object({
        id: z.string(),
        allowance: z.string(),
        days: z.number().int().positive(),
        coverage_code: z.string(),
      }),
    );
    const local = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await client
        .from("catalog_plans")
        .select("id,allowance,days,coverage_code")
        .eq("is_published", true)
        .order("id")
        .range(offset, offset + 999);
      if (error) throw new Error("Catalog lookup failed");
      const rows = schema.parse(data);
      local.push(
        ...rows.map((row) => ({
          id: row.id,
          allowance: row.allowance,
          days: row.days,
          coverageCode: row.coverage_code,
        })),
      );
      if (rows.length < 1000) break;
      if (local.length > 20000) throw new Error("Catalog limit reached");
    }
    if (!local.length) throw new Error("Empty catalog");
    const report = compareProviderCatalog(local, packages);
    return Response.json(
      {
        connected: true,
        fixedProviderPlans: packages.length,
        publishedPlans: local.length,
        matchedPlans: report.matches.length,
        unavailablePlans: report.missing.length,
        identityConflicts: report.conflicts.length,
        newProviderPlans: report.unlisted.length,
      },
      { status: report.conflicts.length ? 409 : 200, headers },
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof EsimAccessError
            ? `provider_${error.kind}`
            : "provider_check_failed",
      },
      { status: 503, headers },
    );
  }
}
