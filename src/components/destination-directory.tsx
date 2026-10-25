"use client";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { searchDestinations, type Destination } from "@/lib/catalog";
import { catalogCopy } from "@/lib/catalog-copy";
import { dictionaries, type Locale } from "@/lib/i18n";
import { DestinationGrid } from "./destination-grid";
export function DestinationDirectory({
  locale,
  items,
}: {
  locale: Locale;
  items: Destination[];
}) {
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState("all");
  const [limit, setLimit] = useState(24);
  const t = dictionaries[locale];
  const c = catalogCopy[locale];
  const matches = searchDestinations(query, items);
  const results = matches
    .filter((destination) => kind === "all" || destination.type === kind)
    .sort((a, b) => a.name[locale].localeCompare(b.name[locale], locale));
  return (
    <>
      <div className="directory-search">
        <label className="sr-only" htmlFor="directory-query">
          {t.destination}
        </label>
        <Search size={21} />
        <input
          id="directory-query"
          type="search"
          enterKeyHint="search"
          value={query}
          placeholder={t.searchPlaceholder}
          onChange={(event) => {
            setQuery(event.target.value);
            setLimit(24);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
        />
        {query && (
          <button
            className="icon-button"
            onClick={() => {
              setQuery("");
              setLimit(24);
            }}
            aria-label={t.clear}
          >
            <X size={17} />
          </button>
        )}
      </div>
      <div className="catalog-tabs" role="group" aria-label={c.coverageType}>
        {[
          ["all", c.all],
          ["country", c.countries],
          ["region", c.regions],
        ].map(([value, label]) => (
          <button
            key={value}
            aria-pressed={kind === value}
            onClick={() => {
              setKind(value);
              setLimit(24);
            }}
          >
            {label}
            <span>
              {value === "all"
                ? matches.length
                : matches.filter((destination) => destination.type === value)
                    .length}
            </span>
          </button>
        ))}
      </div>
      <p className="directory-count" aria-live="polite">
        {c.showing} {Math.min(limit, results.length)} {c.of} {results.length}{" "}
        {t.nav.destinations.toLowerCase()}
      </p>
      {results.length ? (
        <DestinationGrid locale={locale} items={results.slice(0, limit)} />
      ) : (
        <div className="empty-state">
          <Search size={28} />
          <p>{c.directoryEmpty}</p>
          <button
            className="button button-secondary"
            onClick={() => {
              setQuery("");
              setKind("all");
            }}
          >
            {t.reset}
          </button>
        </div>
      )}
      {results.length > limit && (
        <div className="load-more">
          <button
            className="button button-secondary"
            onClick={() => setLimit(limit + 24)}
          >
            {c.loadMore}
          </button>
        </div>
      )}
    </>
  );
}
