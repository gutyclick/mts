import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { pathFor, type Locale } from "@/lib/i18n";
import type { Destination } from "@/lib/catalog";
import { getPlans } from "@/lib/plans";
import { PlanBrowser } from "@/components/plan-browser";
import { DestinationArtwork } from "@/components/illustrations";
import { DestinationFlag } from "@/components/destination-flag";

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
  return (
    <div className="container destination-page destination-product-page">
      <Link className="back-link" href={pathFor(locale, "destinations")}>
        <ArrowLeft size={16} />
        {es ? "Todos los destinos" : "All destinations"}
      </Link>
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
        availablePlans={getPlans(destination)}
        initialDays={initialDays}
        initialPlanId={initialPlanId}
      />
    </div>
  );
}
