import type { Locale } from "@/lib/i18n";
import type { Destination } from "@/lib/catalog";
import type { Plan } from "@/lib/plan-utils";
import { DestinationPlanPage } from "./destination-plan-page";

// Existing shared plan links open the same selector with that plan selected.
export function PlanDetail({
  locale,
  destination,
  plan,
}: {
  locale: Locale;
  destination: Destination;
  plan: Plan;
}) {
  return (
    <DestinationPlanPage
      locale={locale}
      destination={destination}
      initialPlanId={plan.id}
    />
  );
}
