import { isPreparingDelivery } from "./esim-installation.ts";

export function isDashboardPreparing(
  order: { livemode: boolean; status: string; fulfillmentStates: string[] },
  publishedProfiles: number,
) {
  return (
    order.livemode &&
    order.status === "paid" &&
    isPreparingDelivery(order.fulfillmentStates, publishedProfiles)
  );
}

export const dashboardSections = [
  "esims",
  "orders",
  "support",
  "account",
] as const;
export type DashboardSection = (typeof dashboardSections)[number];
export const dashboardFilters = ["all", "ready", "active", "ended"] as const;
export type DashboardFilter = (typeof dashboardFilters)[number];
export function dashboardSection(
  value?: string,
  selectedId?: string,
): DashboardSection {
  if (selectedId) return "esims";
  return dashboardSections.find((section) => section === value) ?? "esims";
}
export function dashboardFilter(value?: string): DashboardFilter {
  return dashboardFilters.find((filter) => filter === value) ?? "all";
}
export function filterDashboardEsims<
  T extends { status: "ready" | "active" | "expired" | "suspended" },
>(records: T[], filter: DashboardFilter): T[] {
  const rank = { ready: 0, active: 1, suspended: 2, expired: 3 };
  return records
    .filter(
      (record) =>
        filter === "all" ||
        record.status === (filter === "ended" ? "expired" : filter),
    )
    .sort((a, b) => rank[a.status] - rank[b.status]);
}
