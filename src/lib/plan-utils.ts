export interface Plan {
  id: string;
  name: string;
  allowance: string;
  dataGb: number;
  days: number;
  kind: "fixed";
  coverageCode: string;
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
