import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { pathFor, type Locale } from "@/lib/i18n";
import type { Destination } from "@/lib/catalog";
import { getPlans } from "@/lib/plans";
import { PlanBrowser } from "@/components/plan-browser";
import { DestinationArtwork } from "@/components/illustrations";
import { DestinationFlag } from "@/components/destination-flag";
import { DestinationGuide } from "./destination-guide";

export function DestinationPlanPage({
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
  const plans = getPlans(destination);
  return (
    <div className="container destination-page destination-product-page">
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
            sizes="(max-width:650px) 90vw, 320px"
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
              ? "Elige tus GB y días. Tu ficha se actualiza al instante."
              : "Pick your data and duration. Your plan details update instantly."}
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
