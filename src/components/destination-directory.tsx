"use client";
import { useState } from "react";
import { Search, X } from "lucide-react";
import { searchDestinations } from "@/lib/catalog";
import { dictionaries, type Locale } from "@/lib/i18n";
import { DestinationGrid } from "./destination-grid";
export function DestinationDirectory({ locale }: { locale: Locale }) {
  const [query, setQuery] = useState("");
  const t = dictionaries[locale];
  const results = searchDestinations(query);
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
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          value={query}
          placeholder={t.searchPlaceholder}
          onChange={(event) => setQuery(event.target.value)}
        />
        {query && (
          <button
            className="icon-button"
            onClick={() => setQuery("")}
            aria-label={t.clear}
          >
            <X size={17} />
          </button>
        )}
      </div>
      <p className="directory-count" aria-live="polite">
        {results.length} {t.nav.destinations.toLowerCase()}
      </p>
      {results.length ? (
        <DestinationGrid locale={locale} items={results} />
      ) : (
        <div className="empty-state">
          <Search size={28} />
          <p>{t.searchEmpty}</p>
          <button
            className="button button-secondary"
            onClick={() => setQuery("")}
          >
            {t.reset}
          </button>
        </div>
      )}
    </>
  );
}
