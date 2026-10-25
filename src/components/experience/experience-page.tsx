import { notFound } from "next/navigation";
import {
  getDestination,
  getPopularDestinations,
  getPublishedPlans,
} from "@/lib/catalog-server";
import type { Locale } from "@/lib/i18n";
import type { ExperienceKey } from "@/lib/experience-routes";
import { Checkout } from "../commerce/checkout";
import { authClient } from "@/lib/supabase/auth-server";
import { catalogConfig } from "@/lib/supabase/catalog-api";
import { CustomerWallet } from "../account/customer-wallet";
import { customerSession, customerEsim } from "@/lib/customer-data";
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
    const user = catalogConfig(process.env)
      ? (await (await authClient()).auth.getUser()).data.user
      : null;
    return (
      <Checkout
        key={plan?.id ?? "empty"}
        locale={locale}
        email={user?.email_confirmed_at ? user.email : undefined}
        initial={
          destination && plan
            ? { destination: destination.slug, planId: plan.id, quantity: 1 }
            : undefined
        }
      />
    );
  }
  if (page === "wallet") {
    return (
      <CustomerWallet
        locale={locale}
        selectedId={typeof query.esim === "string" ? query.esim : undefined}
      />
    );
  }
  if (page === "install") {
    const id = typeof query.esim === "string" ? query.esim : undefined;
    if (id) {
      const { client, user } = await customerSession(
        locale,
        `/${locale}/${locale === "es" ? "mis-esim" : "my-esims"}?esim=${encodeURIComponent(id)}`,
      );
      if (!(await customerEsim(client, user.id, id))) notFound();
    }
    return <InstallGuide locale={locale} esimId={id} />;
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
