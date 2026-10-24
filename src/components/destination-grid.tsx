import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { destinations, type Destination } from "@/lib/catalog";
import { dictionaries, pathFor, type Locale } from "@/lib/i18n";
import { catalogCopy } from "@/lib/catalog-copy";
import { DestinationArtwork } from "./illustrations";
import { DestinationFlag } from "./destination-flag";

export function DestinationGrid({
  locale,
  items = destinations,
}: {
  locale: Locale;
  items?: Destination[];
}) {
  const t = dictionaries[locale];
  const c = catalogCopy[locale];
  return (
    <div className="destination-grid">
      {items.map((destination) => (
        <Link
          href={pathFor(locale, undefined, destination.slug)}
          key={destination.slug}
          className="destination-card"
        >
          <div className="destination-photo">
            <DestinationArtwork destination={destination} locale={locale} />
            {destination.artworkKind !== "flag" && (
              <span className="country-stamp">
                <DestinationFlag destination={destination} />
              </span>
            )}
          </div>
          <div className="destination-card-body">
            <div>
              <h3>{destination.name[locale]}</h3>
              <p className="destination-plan-count">
                {destination.planCount}{" "}
                {destination.planCount === 1 ? c.plan : c.plans}
              </p>
            </div>
            <span className="destination-arrow">
              <ArrowUpRight size={19} />
            </span>
          </div>
          <span className="card-sample">
            {destination.type === "region" ? t.region : t.country}
          </span>
        </Link>
      ))}
    </div>
  );
}
