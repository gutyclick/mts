"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowRight, Globe2, Menu, X } from "lucide-react";
import {
  dictionaries,
  equivalentPath,
  pathFor,
  type Locale,
  type PageKey,
} from "@/lib/i18n";
import { Brand } from "./ui";
import { experiencePath } from "@/lib/experience-routes";
import { experienceCopy } from "@/lib/experience-copy";

export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const pathname = usePathname();
  const query = useSearchParams().toString();
  const target = locale === "en" ? "es" : "en";
  return (
    <a
      className="language-switch"
      href={`${equivalentPath(pathname, target)}${query ? `?${query}` : ""}`}
      onClick={(event) => {
        event.currentTarget.href = `${equivalentPath(pathname, target)}${window.location.search}${window.location.hash}`;
      }}
      onAuxClick={(event) => {
        event.currentTarget.href = `${equivalentPath(pathname, target)}${window.location.search}${window.location.hash}`;
      }}
      hrefLang={target}
      aria-label={`${locale.toUpperCase()} / ${target.toUpperCase()} — ${dictionaries[locale].language}: ${target === "es" ? "Español" : "English"}`}
    >
      <Globe2 size={17} />
      <span>{locale.toUpperCase()}</span>
      <span className="language-alternative">/ {target.toUpperCase()}</span>
    </a>
  );
}
export function Header({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false);
  const t = dictionaries[locale];
  const pathname = usePathname();
  const pages: PageKey[] = [
    "destinations",
    "how",
    "compatibility",
    "faq",
    "help",
  ];
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link
          href={pathFor(locale)}
          aria-label="MyTripSim"
          onClick={() => setOpen(false)}
        >
          <Brand />
        </Link>
        <nav className="desktop-nav" aria-label={t.explore}>
          {pages
            .filter((page) => page !== "compatibility")
            .map((page) => (
              <Link
                key={page}
                href={pathFor(locale, page)}
                aria-current={
                  pathname === pathFor(locale, page)
                    ? "page"
                    : pathname.startsWith(`${pathFor(locale, page)}/`)
                      ? "location"
                      : undefined
                }
              >
                {t.nav[page]}
              </Link>
            ))}
          <Link
            href={experiencePath(locale, "wallet")}
            aria-current={
              pathname === experiencePath(locale, "wallet") ? "page" : undefined
            }
          >
            {experienceCopy[locale].wallet}
          </Link>
        </nav>
        <div className="header-actions">
          <LanguageSwitcher locale={locale} />
          <Link
            className="button button-primary header-cta"
            href={pathFor(locale, "destinations")}
          >
            {t.find}
            <ArrowRight size={16} />
          </Link>
          <button
            className="icon-button mobile-toggle"
            aria-label={open ? t.close : t.menu}
            aria-expanded={open}
            aria-controls="mobile-navigation"
            onClick={() => setOpen(!open)}
          >
            {open ? <X /> : <Menu />}
          </button>
        </div>
        {open && (
          <nav
            id="mobile-navigation"
            className="mobile-nav"
            aria-label={t.explore}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setOpen(false);
                document
                  .querySelector<HTMLButtonElement>(".mobile-toggle")
                  ?.focus();
              }
            }}
          >
            {pages.map((page) => (
              <Link
                key={page}
                href={pathFor(locale, page)}
                onClick={() => setOpen(false)}
              >
                {t.nav[page]}
                <ArrowRight size={17} />
              </Link>
            ))}
            <Link
              href={experiencePath(locale, "wallet")}
              onClick={() => setOpen(false)}
            >
              {experienceCopy[locale].wallet}
              <ArrowRight size={17} />
            </Link>
            <Link
              className="button button-primary"
              href={pathFor(locale, "destinations")}
              onClick={() => setOpen(false)}
            >
              {t.find}
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
