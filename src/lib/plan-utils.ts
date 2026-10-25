export interface Plan {
  id: string;
  name: string;
  allowance: string;
  dataGb: number;
  days: number;
  kind: "fixed";
  coverageCode: string;
  retailPriceCents?: number;
  details?: PlanDetails;
}
export interface PlanDetails {
  dataGb: number;
  days: number;
  coverage: string[];
  technologies: string[];
  activation: "network" | "installation" | "purchase";
  topUp: "same-area-data" | "none";
  networks: {
    countryCode?: string;
    countryName?: string;
    operators: { name: string; technologies: string[] }[];
  }[];
  apn?: string;
  fairUse?: string;
}
export function filterPlans(plans: Plan[], data: string, days: string) {
  return plans.filter(
    (plan) =>
      (!data || plan.dataGb === Number(data)) &&
      (!days || plan.days === Number(days)),
  );
}
export function sortPlans(plans: Plan[], order: "data" | "days" = "data") {
  return [...plans].sort(
    (a, b) =>
      (order === "days"
        ? a.days - b.days || a.dataGb - b.dataGb
        : a.dataGb - b.dataGb || a.days - b.days) || a.id.localeCompare(b.id),
  );
}
