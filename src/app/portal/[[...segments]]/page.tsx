import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PortalApp } from "@/components/portal/portal-app";
import { portalScreen, portalCopy } from "@/lib/portal/copy";
import type { Metadata } from "next";
import {
  businessIdentity,
  businessWorkspace,
  businessSupport,
} from "@/lib/portal/server";
import { toPortalTrip, canManageTrips } from "@/lib/portal/business";
import { PortalProvider } from "@/components/portal/portal-state";
import {
  PortalAccess,
  PortalApplication,
} from "@/components/portal/portal-access";
import { destinations } from "@/lib/catalog";
import { portalHref } from "@/lib/portal/copy";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}): Promise<Metadata> {
  const { segments = [] } = await params;
  const locale = segments[0] === "en" ? "en" : "es";
  const route = portalScreen(locale, segments.slice(1));
  return {
    title: {
      absolute: `${route ? portalCopy[locale][route.view] : portalCopy[locale].business} · MyTripSim Business`,
    },
    description: portalCopy[locale].welcome,
    robots: { index: false, follow: false },
    openGraph: { images: [] },
  };
}

export default async function PortalPage({
  params,
}: {
  params: Promise<{ segments?: string[] }>;
}) {
  const { segments = [] } = await params;
  const subdomain = (await headers()).get("x-mytripsim-surface") === "portal";
  if (!segments.length) redirect(subdomain ? "/es" : "/portal/es");
  const [locale, ...path] = segments;
  if (locale !== "es" && locale !== "en") notFound();
  const route = portalScreen(locale, path);
  if (!route) notFound();
  const base = subdomain ? "" : "/portal";
  const identity = await businessIdentity();
  if (!identity.user || identity.needsMfa)
    return <PortalAccess locale={locale} base={base} mfa={identity.needsMfa} />;
  const workspace = await businessWorkspace(identity.client);
  if (!workspace.company)
    return <PortalApplication locale={locale} base={base} />;
  if (
    ["new", "request"].includes(route.view) &&
    !canManageTrips(workspace.company.role)
  )
    redirect(portalHref(locale, base, "trips"));
  if (route.view === "access" || route.view === "review")
    redirect(portalHref(locale, base, "home"));
  const trips = workspace.trips.map((trip) =>
    toPortalTrip(
      trip,
      destinations.find((value) => value.slug === trip.destination_slug)?.name[
        locale
      ] ?? trip.destination_slug,
    ),
  );
  return (
    <PortalProvider
      trips={trips}
      workspace={workspace}
      support={businessSupport()}
    >
      <PortalApp locale={locale} route={route} base={base} />
    </PortalProvider>
  );
}
