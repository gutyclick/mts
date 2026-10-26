import Link from "next/link";
import type { Destination } from "@/lib/catalog";
import { pathFor, type Locale } from "@/lib/i18n";
import { absoluteUrl } from "@/lib/seo";
import { JsonLd } from "./json-ld";

export function DestinationIndex({
  items,
  locale,
}: {
  items: Destination[];
  locale: Locale;
}) {
  const sorted = [...items].sort((a, b) =>
    a.name[locale].localeCompare(b.name[locale], locale),
  );
  return (
    <section
      className="destination-text-index"
      aria-labelledby="destination-index-title"
    >
      <h2 id="destination-index-title">
        {locale === "es"
          ? "Todos los destinos eSIM, de A a Z"
          : "All eSIM destinations, A to Z"}
      </h2>
      <p>
        {locale === "es"
          ? "Encuentra tu país o una región para comparar sus planes y cobertura."
          : "Find a country or region to compare its plans and coverage."}
      </p>
      <details>
        <summary>
          {locale === "es"
            ? `Explorar los ${items.length} destinos`
            : `Explore all ${items.length} destinations`}
        </summary>
        <ul>
          {sorted.map((item) => (
            <li key={item.slug}>
              <Link href={pathFor(locale, undefined, item.slug)}>
                {item.name[locale]}
              </Link>
            </li>
          ))}
        </ul>
      </details>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name:
            locale === "es"
              ? "Destinos eSIM de MyTripSim"
              : "MyTripSim eSIM destinations",
          url: absoluteUrl(pathFor(locale, "destinations")),
          inLanguage: locale,
          mainEntity: {
            "@type": "ItemList",
            numberOfItems: sorted.length,
            itemListElement: sorted.map((item, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: item.name[locale],
              url: absoluteUrl(pathFor(locale, undefined, item.slug)),
            })),
          },
        }}
      />
    </section>
  );
}
