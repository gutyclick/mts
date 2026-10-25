import type { ProviderPackage } from "./esimaccess-api.ts";

export type CatalogIdentity = {
  id: string;
  allowance: string;
  days: number;
  coverageCode: string;
};
export type ProviderBinding = {
  planId: string;
  packageCode: string;
  providerSlug: string;
  volumeBytes: number;
  days: number;
};
export function compareProviderCatalog(
  local: CatalogIdentity[],
  remote: ProviderPackage[],
) {
  const index = new Map(remote.map((plan) => [plan.slug, plan]));
  const matches: ProviderBinding[] = [];
  const missing: string[] = [];
  const conflicts: {
    planId: string;
    reason: "data" | "duration" | "coverage";
  }[] = [];
  for (const plan of local) {
    const candidate = index.get(plan.id);
    if (!candidate) {
      missing.push(plan.id);
      continue;
    }
    const amount = /^(\d+(?:\.\d+)?)\s*(GB|MB)$/i.exec(plan.allowance.trim());
    const expected = amount
      ? [
          Number(amount[1]) *
            (amount[2].toUpperCase() === "GB" ? 1024 ** 3 : 1024 ** 2),
          Number(amount[1]) *
            (amount[2].toUpperCase() === "GB" ? 1000 ** 3 : 1000 ** 2),
        ]
      : [];
    const reason =
      candidate.days !== plan.days
        ? "duration"
        : !expected.some((bytes) => Math.abs(bytes - candidate.volumeBytes) < 1)
          ? "data"
          : /^[A-Z]{2}$/.test(plan.coverageCode) &&
              !candidate.coverage.includes(plan.coverageCode)
            ? "coverage"
            : null;
    if (reason) {
      conflicts.push({ planId: plan.id, reason });
      continue;
    }
    matches.push({
      planId: plan.id,
      packageCode: candidate.packageCode,
      providerSlug: candidate.slug,
      volumeBytes: candidate.volumeBytes,
      days: candidate.days,
    });
  }
  const ids = new Set(local.map((plan) => plan.id));
  return {
    matches,
    missing,
    conflicts,
    unlisted: remote
      .filter((plan) => !ids.has(plan.slug))
      .map((plan) => plan.slug),
  };
}
