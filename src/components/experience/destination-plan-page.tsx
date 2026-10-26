import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { pathFor, type Locale } from "@/lib/i18n";
import type { Destination } from "@/lib/catalog";
import { getPublishedPlans } from "@/lib/catalog-server";
import { PlanBrowser } from "@/components/plan-browser";
import { DestinationArtwork } from "@/components/illustrations";
import { DestinationFlag } from "@/components/destination-flag";
import { JsonLd } from "@/components/seo/json-ld";
import { breadcrumbSchema, absoluteUrl } from "@/lib/seo";
import { DestinationGuide } from "./destination-guide";

export async function DestinationPlanPage({
  locale,
  destination,
  initialDays = "",
  initialPlanId = "",
}: {
  locale: Locale;
  destination: Destination;
  initialDays?: string;
  initialPlanId?: string;
}) {
  const es = locale === "es";
  const plans = await getPublishedPlans(destination);
  return (
    <div className="container destination-page destination-product-page">
      <JsonLd
        data={breadcrumbSchema([
          { name: es ? "Inicio" : "Home", path: pathFor(locale) },
          {
            name: es ? "Destinos" : "Destinations",
            path: pathFor(locale, "destinations"),
          },
          {
            name: destination.name[locale],
            path: pathFor(locale, undefined, destination.slug),
          },
        ])}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: destination.name[locale] + " eSIM",
          url: absoluteUrl(pathFor(locale, undefined, destination.slug)),
          inLanguage: locale,
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: plans.length,
            itemListElement: plans.map((plan, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: plan.name,
              url: absoluteUrl(
                pathFor(locale, undefined, destination.slug) +
                  "?plan=" +
                  encodeURIComponent(plan.id),
              ),
            })),
          },
        }}
      />
      <nav
        className="destination-breadcrumb"
        aria-label={es ? "Ruta de navegación" : "Breadcrumb"}
      >
        <ol>
          <li>
            <Link href={pathFor(locale)}>
              <Home size={14} aria-hidden="true" />
              {es ? "Inicio" : "Home"}
            </Link>
          </li>
          <li>
            <ChevronRight size={13} aria-hidden="true" />
            <Link href={pathFor(locale, "destinations")}>
              {es ? "Destinos" : "Destinations"}
            </Link>
          </li>
          <li>
            <ChevronRight size={13} aria-hidden="true" />
            <span aria-current="page">{destination.name[locale]}</span>
          </li>
        </ol>
      </nav>
      <header className="destination-product-header">
        <div className="destination-product-image">
          <DestinationArtwork
            destination={destination}
            locale={locale}
            sizes="(max-width:650px) 88px, 270px"
            eager
          />
        </div>
        <div>
          <p className="eyebrow">{es ? "eSIM de viaje" : "Travel eSIM"}</p>
          <h1 aria-label={`${destination.name[locale]} eSIM`}>
            <DestinationFlag destination={destination} />
            {destination.name[locale]}
            <span> eSIM</span>
          </h1>
          <p>
            {es
              ? "Elige tus GB y días, revisa la red y continúa."
              : "Choose your data and days, check the network and continue."}
          </p>
        </div>
      </header>
      <PlanBrowser
        locale={locale}
        destination={destination}
        availablePlans={plans}
        initialDays={initialDays}
        initialPlanId={initialPlanId}
      />
      <DestinationGuide
        locale={locale}
        destination={destination}
        plans={plans}
      />
    </div>
  );
}
