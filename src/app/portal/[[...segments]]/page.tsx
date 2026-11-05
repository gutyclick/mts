import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { PortalApp } from "@/components/portal/portal-app";
import { portalScreen, portalCopy } from "@/lib/portal/copy";
import type { Metadata } from "next";

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
  return (
    <PortalApp
      locale={locale}
      route={route}
      base={subdomain ? "" : "/portal"}
    />
  );
}
