import { parseDestinationRow, parsePlanRow } from "./catalog-schema.ts";

type Config = { url: string; key: string };
export function catalogConfig(
  env: Record<string, string | undefined>,
): Config | null {
  if (!env.SUPABASE_URL && !env.SUPABASE_PUBLISHABLE_KEY) return null;
  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY)
    throw new Error("Supabase catalog configuration is incomplete");
  const url = new URL(env.SUPABASE_URL);
  if (
    url.protocol !== "https:" &&
    !(
      url.protocol === "http:" &&
      ["localhost", "127.0.0.1"].includes(url.hostname)
    )
  )
    throw new Error("Supabase requires HTTPS outside local development");
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/"
  )
    throw new Error("Use the Supabase project base URL");
  const key = env.SUPABASE_PUBLISHABLE_KEY;
  if (!key.startsWith("sb_publishable_"))
    throw new Error(
      "The public catalog requires a Supabase publishable key, not a secret key",
    );
  return { url: url.origin, key };
}

export function createCatalogAPI(
  config: Config,
  request: typeof fetch = fetch,
) {
  async function rows(table: string, query: Record<string, string>) {
    const result: Record<string, unknown>[] = [];
    const pageSize = 500;
    for (let offset = 0; ; offset += pageSize) {
      const url = new URL(`/rest/v1/${table}`, config.url);
      for (const [key, value] of Object.entries({
        ...query,
        offset: String(offset),
        limit: String(pageSize),
      }))
        url.searchParams.set(key, value);
      let response: Response;
      try {
        response = await request(url, {
          headers: { apikey: config.key, Accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(10000),
        });
      } catch {
        // Avoid leaking request headers, URLs or upstream details in logs/UI.
        throw new Error("Supabase catalog is temporarily unavailable");
      }
      if (!response.ok) throw new Error("Supabase catalog request failed");
      let page: unknown;
      try {
        page = await response.json();
      } catch {
        throw new Error("Supabase returned an invalid catalog response");
      }
      if (
        !Array.isArray(page) ||
        page.some((r) => !r || typeof r !== "object" || Array.isArray(r))
      )
        throw new Error("Supabase returned an invalid catalog response");
      result.push(...page);
      if (page.length < pageSize) return result;
      if (offset >= 100000)
        throw new Error("Supabase catalog exceeded the safety limit");
    }
  }
  return {
    async destinations() {
      const data = await rows("published_catalog_destinations", {
        select:
          "slug,name,code,type,aliases,image,artwork_kind,plan_count,data_min_gb,data_max_gb",
        order: "slug.asc",
      });
      try {
        return data.map(parseDestinationRow);
      } catch {
        throw new Error("Supabase destination data is invalid");
      }
    },
    async plans(slug: string) {
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug))
        throw new Error("Invalid destination slug");
      const data = await rows("catalog_plans", {
        select: "id,name,allowance,data_gb,days,kind,coverage_code,details",
        destination_slug: `eq.${slug}`,
        is_published: "eq.true",
        order: "data_gb.asc,days.asc,id.asc",
      });
      try {
        return data.map(parsePlanRow);
      } catch {
        throw new Error("Supabase plan data is invalid");
      }
    },
  };
}
