import { notFound } from "next/navigation";
import {
  getDestination,
  getPopularDestinations,
  getPublishedPlans,
} from "@/lib/catalog-server";
import { demoEsims } from "@/lib/demo-esims";
import type { Locale } from "@/lib/i18n";
import type { ExperienceKey } from "@/lib/experience-routes";
import { CheckoutPreview } from "./checkout-preview";
import { EsimWallet } from "./esim-wallet";
import { InstallGuide } from "./install-guide";
import { AdminPreview } from "./admin-preview";
export type ExperienceQuery = Record<string, string | string[] | undefined>;
export async function ExperiencePage({
  locale,
  page,
  query,
}: {
  locale: Locale;
  page: ExperienceKey;
  query: ExperienceQuery;
}) {
  if (page === "checkout") {
    const destination =
      typeof query.destination === "string"
        ? await getDestination(query.destination)
        : undefined;
    const plan = destination
      ? (await getPublishedPlans(destination)).find((p) => p.id === query.plan)
      : undefined;
    if ((query.destination || query.plan) && (!destination || !plan))
      notFound();
    return (
      <CheckoutPreview
        key={plan?.id ?? "empty"}
        locale={locale}
        destination={destination}
        plan={plan}
      />
    );
  }
  if (page === "wallet" || page === "install") {
    const selected = demoEsims.find((record) => record.id === query.esim);
    if (query.esim && !selected) notFound();
    return page === "wallet" ? (
      <EsimWallet
        key={selected?.id ?? "wallet"}
        locale={locale}
        selected={selected}
      />
    ) : (
      <InstallGuide locale={locale} esimId={selected?.id} />
    );
  }
  return (
    <AdminPreview
      locale={locale}
      samples={(
        await Promise.all(
          (await getPopularDestinations()).map(async (d) =>
            (await getPublishedPlans(d))
              .filter((p) => p.kind === "fixed")
              .slice(0, 2)
              .map((plan) => ({ slug: d.slug, plan })),
          ),
        )
      ).flat()}
    />
  );
}
