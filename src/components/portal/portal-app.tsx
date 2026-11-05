"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  ChevronRight,
  CircleHelp,
  ClipboardCheck,
  Globe2,
  Headphones,
  House,
  Luggage,
  Plus,
  Search,
  Users,
  Wallet,
} from "lucide-react";
import {
  portalCopy,
  portalHref,
  type PortalRoute,
  type PortalView,
} from "@/lib/portal/copy";
import { summarizeTrips } from "@/lib/portal/model";
import { usePortal } from "./portal-state";
import {
  PageHeading,
  PortalButton,
  TripCard,
  type PortalProps,
} from "./portal-ui";
import { PortalTripForm } from "./portal-trip-form";
import { PortalTripDetail } from "./portal-trip";
import { PortalRequest } from "./portal-request";
import { PortalTeam, PortalSupport } from "./portal-team";
import { PortalLogout } from "./portal-access";
import { canManageTrips } from "@/lib/portal/business";
import { roleLabel } from "./portal-business-copy";

function Overview({ locale, base }: PortalProps) {
  const t = portalCopy[locale];
  const { trips, company } = usePortal();
  const totals = summarizeTrips(trips);
  const upcoming = [...trips]
    .sort((a, b) => a.departure.localeCompare(b.departure))
    .slice(0, 3);
  return (
    <>
      <section className="bp-welcome">
        <div>
          <span className="bp-eyebrow">MYTRIPSIM BUSINESS</span>
          <h1>{t.headline}</h1>
          <p>{t.welcome}</p>
          {canManageTrips(company.role) && (
            <PortalButton href={portalHref(locale, base, "new")}>
              <Plus size={18} />
              {t.new}
            </PortalButton>
          )}
        </div>
        <Image
          src="/images/sim/sim_traveler.png"
          width={220}
          height={220}
          alt="SIM"
          priority
          sizes="(max-width: 600px) 100px, 200px"
        />
      </section>
      <section className="bp-stats" aria-label={t.overview}>
        {[
          { icon: Luggage, value: trips.length, label: t.trips, tone: "blue" },
          {
            icon: Users,
            value: totals.travelers,
            label: t.travelers,
            tone: "orange",
          },
          {
            icon: ClipboardCheck,
            value: totals.pending,
            label: t.pending,
            tone: "blue",
          },
          {
            icon: Check,
            value: totals.activated,
            label: t.activated,
            tone: "green",
          },
        ].map(({ icon: Icon, value, label, tone }) => (
          <div className="bp-stat" key={label}>
            <span className={`bp-icon bp-icon-${tone}`}>
              <Icon size={19} />
            </span>
            <div>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          </div>
        ))}
      </section>
      <section>
        <div className="bp-section-head">
          <h2>{t.upcoming}</h2>
          <Link href={portalHref(locale, base, "trips")}>
            {t.allTrips}
            <ArrowRight size={16} />
          </Link>
        </div>
        {upcoming.length ? (
          <div className="bp-trip-grid">
            {upcoming.map((trip) => (
              <TripCard key={trip.id} trip={trip} locale={locale} base={base} />
            ))}
          </div>
        ) : (
          <div className="bp-panel bp-empty">
            <Luggage size={28} />
            <h2>
              {locale === "es"
                ? "Tu primer viaje empieza aquí"
                : "Your first trip starts here"}
            </h2>
            <p>
              {canManageTrips(company.role)
                ? locale === "es"
                  ? "Crea un viaje para organizar el grupo y preparar su solicitud de eSIM."
                  : "Create a trip to organize the group and prepare its eSIM request."
                : locale === "es"
                  ? "El coordinador de tu empresa añadirá los próximos viajes."
                  : "Your company coordinator will add upcoming trips."}
            </p>
          </div>
        )}
      </section>
      <section className="bp-bottom-grid">
        <div className="bp-panel">
          <div className="bp-section-head">
            <h2>{t.nextSteps}</h2>
            <Luggage size={20} />
          </div>
          <ol className="bp-steps">
            {[t.step1, t.step2, t.step3].map((step, index) => (
              <li key={step}>
                <span>{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </div>
        <div className="bp-support-card">
          <span className="bp-icon bp-icon-orange">
            <Headphones size={22} />
          </span>
          <h2>{t.contact}</h2>
          <p>
            {locale === "es"
              ? "Un canal privado para acompañar a tu empresa en cada viaje."
              : "A private channel to support your business on every trip."}
          </p>
          <Link href={portalHref(locale, base, "help")}>
            {t.help}
            <ArrowRight size={17} />
          </Link>
        </div>
      </section>
    </>
  );
}

function Trips({ locale, base }: PortalProps) {
  const { trips, company } = usePortal();
  const [query, setQuery] = useState("");
  const t = portalCopy[locale];
  const normalize = (value: string) =>
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const results = trips.filter((trip) =>
    normalize(`${trip.name} ${trip.destination}`).includes(normalize(query)),
  );
  return (
    <>
      <PageHeading
        title={t.trips}
        description={
          locale === "es"
            ? "Cada grupo tiene su espacio. Encuentra el próximo."
            : "A place for every group. Find your next trip."
        }
      >
        {canManageTrips(company.role) && (
          <PortalButton href={portalHref(locale, base, "new")}>
            <Plus size={18} />
            {t.new}
          </PortalButton>
        )}
      </PageHeading>
      <label className="bp-search">
        <Search size={19} />
        <input
          type="search"
          aria-label={t.search}
          placeholder={t.search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {results.length ? (
        <div className="bp-trip-grid">
          {results.map((trip) => (
            <TripCard key={trip.id} trip={trip} locale={locale} base={base} />
          ))}
        </div>
      ) : (
        <div className="bp-empty">
          <Search size={30} />
          <h2>{t.noResults}</h2>
          <p>{t.noResultsHint}</p>
        </div>
      )}
    </>
  );
}

function SupportingPage({
  locale,
  base,
  view,
}: PortalProps & { view: PortalView }) {
  const t = portalCopy[locale];
  if (view === "team") return <PortalTeam locale={locale} base={base} />;
  if (view === "help") return <PortalSupport locale={locale} base={base} />;
  return (
    <>
      <PageHeading title={t.billingTitle} description={t.billingInfo} />
      <section className="bp-panel bp-empty">
        <Wallet size={32} />
        <h2>{t.billing}</h2>
        <p>
          {locale === "es"
            ? "Los presupuestos y documentos se asociarán a cada solicitud. Todavía no se han generado documentos de facturación en este portal."
            : "Quotes and documents will be linked to each request. No billing documents have been generated in this portal yet."}
        </p>
      </section>
    </>
  );
}

export function PortalApp({
  locale,
  route,
  base,
}: PortalProps & { route: PortalRoute }) {
  const t = portalCopy[locale];
  const { trips, company } = usePortal();
  const trip = trips.find((value) => value.id === route.tripId);
  const nav = [
    { view: "home", icon: House },
    { view: "trips", icon: Luggage },
    { view: "team", icon: Users },
    { view: "billing", icon: Wallet },
    { view: "help", icon: CircleHelp },
  ] as const;
  const active = ["trip", "request", "new"].includes(route.view)
    ? "trips"
    : route.view;
  const otherLocale = locale === "es" ? "en" : "es";
  return (
    <div className="bp-app" lang={locale}>
      <a href="#portal-content" className="bp-skip">
        {locale === "es" ? "Ir al contenido" : "Skip to content"}
      </a>
      <aside className="bp-sidebar">
        <Link
          href={portalHref(locale, base, "home")}
          className="bp-brand"
          aria-label="MyTripSim Business"
        >
          <Image
            src="/logomytripsim.png"
            alt="MyTripSim"
            width={1667}
            height={417}
            sizes="155px"
          />
          <span>BUSINESS</span>
        </Link>
        <div className="bp-company">
          <span className="bp-icon">
            <Building2 size={19} />
          </span>
          <div>
            <strong>{company.name}</strong>
            <small>{roleLabel(company.role, locale)}</small>
          </div>
        </div>
        <nav aria-label={t.menu}>
          {nav.map(({ view, icon: Icon }) => (
            <Link
              key={view}
              href={portalHref(locale, base, view)}
              className={active === view ? "bp-nav-active" : ""}
              aria-current={active === view ? "page" : undefined}
            >
              <Icon size={20} />
              <span>{t[view]}</span>
            </Link>
          ))}
        </nav>
        <div className="bp-sidebar-bottom">
          <PortalLogout locale={locale} base={base} />
          <a
            href={`https://www.mytripsim.com/${locale}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ArrowUpRight size={18} />
            {t.store}
          </a>
        </div>
      </aside>
      <div className="bp-workspace">
        <header className="bp-topbar">
          <div className="bp-breadcrumb">
            <Building2 size={17} />
            <span>{t.business}</span>
            <ChevronRight size={14} />
            <strong>{t[route.view]}</strong>
          </div>
          <div className="bp-topbar-actions">
            <Link
              className="bp-language"
              href={portalHref(otherLocale, base, route.view, route.tripId)}
              aria-label={t.language}
            >
              <Globe2 size={17} />
              {otherLocale.toUpperCase()}
            </Link>
            <Link
              className="bp-avatar"
              aria-label={t.team}
              href={portalHref(locale, base, "team")}
            >
              {company.name
                .split(/\s+/)
                .map((word) => word[0])
                .slice(0, 2)
                .join("")
                .toUpperCase()}
            </Link>
          </div>
        </header>
        <main id="portal-content" className="bp-main" tabIndex={-1}>
          {route.view === "home" ? (
            <Overview locale={locale} base={base} />
          ) : route.view === "trips" ? (
            <Trips locale={locale} base={base} />
          ) : route.view === "new" ? (
            <PortalTripForm locale={locale} base={base} />
          ) : route.view === "trip" || route.view === "request" ? (
            trip ? (
              route.view === "trip" ? (
                <PortalTripDetail
                  key={trip.id}
                  trip={trip}
                  locale={locale}
                  base={base}
                />
              ) : (
                <PortalRequest
                  key={trip.id}
                  trip={trip}
                  locale={locale}
                  base={base}
                />
              )
            ) : (
              <div className="bp-empty">
                <Luggage size={32} />
                <h1>{t.missing}</h1>
                <PortalButton href={portalHref(locale, base, "trips")}>
                  {t.back}
                </PortalButton>
              </div>
            )
          ) : (
            <SupportingPage locale={locale} base={base} view={route.view} />
          )}
          <footer className="bp-footer">
            <span>MyTripSim Business</span>
            <span>
              {locale === "es"
                ? "Conexiones para cada aventura."
                : "Connections for every adventure."}
            </span>
          </footer>
        </main>
      </div>
      <nav
        className="bp-mobile-nav"
        aria-label={t.menu}
        style={{
          gridTemplateColumns: `repeat(${canManageTrips(company.role) ? 5 : 4},minmax(0,1fr))`,
        }}
      >
        {[
          { view: "home", icon: House },
          { view: "trips", icon: Luggage },
          { view: "new", icon: Plus },
          { view: "team", icon: Users },
          { view: "help", icon: Headphones },
        ]
          .filter((item) => canManageTrips(company.role) || item.view !== "new")
          .map(({ view, icon: Icon }) => (
            <Link
              key={view}
              href={portalHref(locale, base, view as PortalView)}
              className={
                route.view === view ||
                (view === "trips" && ["trip", "request"].includes(route.view))
                  ? `bp-nav-active ${view === "new" ? "bp-mobile-create" : ""}`
                  : view === "new"
                    ? "bp-mobile-create"
                    : ""
              }
              aria-current={route.view === view ? "page" : undefined}
            >
              <Icon size={21} />
              <span>{t[view as PortalView]}</span>
            </Link>
          ))}
      </nav>
    </div>
  );
}
