import Link from "next/link";
import { ArrowUpRight, Globe2 } from "lucide-react";
import { destinations, money, type Destination } from "@/lib/catalog";
import { dictionaries, pathFor, type Locale } from "@/lib/i18n";
import { DestinationArtwork } from "./illustrations";

export function DestinationGrid({
  locale,
  items = destinations,
}: {
  locale: Locale;
  items?: Destination[];
}) {
  const t = dictionaries[locale];
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
            <span className="country-stamp">
              {destination.type === "region" ? (
                <Globe2 size={15} />
              ) : (
                destination.code
              )}
            </span>
          </div>
          <div className="destination-card-body">
            <div>
              <h3>{destination.name[locale]}</h3>
              <p>
                {t.from}{" "}
                <strong>{money(destination.startingPrice, locale)}</strong>
                <span> USD</span>
              </p>
            </div>
            <span className="destination-arrow">
              <ArrowUpRight size={19} />
            </span>
          </div>
          <span className="card-sample">{t.samplePrice}</span>
        </Link>
      ))}
    </div>
  );
}
