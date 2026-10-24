export interface Plan {
  id: string;
  name: string;
  allowance: string;
  dataGb: number;
  days: number;
  kind: "fixed" | "daily";
  coverageCode: string;
}
export function filterPlans(
  plans: Plan[],
  data: string,
  days: string,
  kind = "all",
) {
  return plans.filter(
    (plan) =>
      (!data || plan.dataGb === Number(data)) &&
      (!days || plan.days === Number(days)) &&
      (kind === "all" || plan.kind === kind),
  );
}
