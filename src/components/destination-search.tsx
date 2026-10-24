"use client";

import {
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, CalendarDays, MapPin, Search, X } from "lucide-react";
import { searchDestinations } from "@/lib/catalog";
import { dictionaries, pathFor, type Locale } from "@/lib/i18n";

export function DestinationSearch({
  locale,
  compact = false,
}: {
  locale: Locale;
  compact?: boolean;
}) {
  const t = dictionaries[locale];
  const router = useRouter();
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [duration, setDuration] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const results = searchDestinations(query);
  function navigate(slug: string) {
    setOpen(false);
    router.push(
      `${pathFor(locale, undefined, slug)}${duration ? `?days=${duration}` : ""}`,
    );
  }
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setActive((previous) =>
        results.length
          ? (previous + (event.key === "ArrowDown" ? 1 : -1) + results.length) %
            results.length
          : -1,
      );
    } else if (event.key === "Escape") {
      event.preventDefault(); // Keep native search clearing from reopening the combobox.
      setOpen(false);
      setActive(-1);
    } else if (
      event.key === "Enter" &&
      open &&
      active >= 0 &&
      results[active]
    ) {
      event.preventDefault();
      navigate(results[active].slug);
    }
  }
  function submit(event: FormEvent) {
    event.preventDefault();
    if (results.length === 1 || (query.trim() && results.length > 0))
      navigate(results[Math.max(active, 0)].slug);
    else if (!query.trim()) router.push(pathFor(locale, "destinations"));
    else setOpen(true);
  }
  return (
    <div className={`search-module ${compact ? "search-compact" : ""}`}>
      <form
        onSubmit={submit}
        className="destination-search"
        role="search"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setOpen(false);
            setActive(-1);
          }
        }}
      >
        <div className="destination-field">
          <label htmlFor={`${id}-input`}>
            <MapPin size={14} />
            {t.destination}
          </label>
          <div className="search-input-wrap">
            <input
              ref={input}
              id={`${id}-input`}
              type="search"
              enterKeyHint="search"
              value={query}
              placeholder={t.searchPlaceholder}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open}
              aria-controls={`${id}-list`}
              aria-activedescendant={
                open && active >= 0 ? `${id}-${active}` : undefined
              }
              autoComplete="off"
              onFocus={(event) => {
                setOpen(true);
                if (window.matchMedia("(max-width: 900px)").matches) {
                  event.currentTarget
                    .closest("form")
                    ?.scrollIntoView({ block: "start", behavior: "instant" });
                }
              }}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(-1);
                setOpen(true);
              }}
              onKeyDown={onKeyDown}
            />
            {query && (
              <button
                type="button"
                className="clear-search"
                aria-label={t.clear}
                onClick={() => {
                  setQuery("");
                  setActive(-1);
                  input.current?.focus();
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
          {open && (
            <div className="search-dropdown">
              <ul id={`${id}-list`} role="listbox" aria-label={t.results}>
                {results.map((destination, index) => (
                  <li
                    key={destination.slug}
                    id={`${id}-${index}`}
                    role="option"
                    aria-selected={active === index}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseMove={() => setActive(index)}
                    onClick={() => navigate(destination.slug)}
                  >
                    <MapPin size={17} />
                    <span>{destination.name[locale]}</span>
                    <ArrowRight size={15} />
                  </li>
                ))}
              </ul>
              {!results.length && (
                <p className="search-empty" role="status">
                  {t.searchEmpty}
                </p>
              )}
            </div>
          )}
        </div>
        {!compact && (
          <div className="duration-field">
            <label htmlFor={`${id}-duration`}>
              <CalendarDays size={14} />
              {t.duration}
            </label>
            <select
              id={`${id}-duration`}
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
            >
              <option value="">{t.optional}</option>
              {[7, 15, 30].map((days) => (
                <option key={days} value={days}>
                  {days} {t.days}
                </option>
              ))}
            </select>
          </div>
        )}
        <button
          className="button button-primary search-button"
          type="submit"
          aria-label={t.find}
        >
          {compact ? (
            <Search size={19} />
          ) : (
            <>
              {t.find}
              <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>
      {!compact && (
        <div className="popular-searches">
          <span>{t.popularSearch}</span>
          {["japan", "united-states", "europe"].map((slug) => {
            const destination = searchDestinations(slug)[0];
            return (
              <Link key={slug} href={pathFor(locale, undefined, slug)}>
                {destination.name[locale]}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
