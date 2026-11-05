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
  ShieldCheck,
  Sparkles,
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
import { PortalTripDetail, PortalRequest, PortalReview } from "./portal-trip";

function Overview({ locale, base }: PortalProps) {
  const t = portalCopy[locale];
  const { trips } = usePortal();
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
          <PortalButton href={portalHref(locale, base, "new")}>
            <Plus size={18} />
            {t.new}
          </PortalButton>
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
        <div className="bp-trip-grid">
          {upcoming.map((trip) => (
            <TripCard key={trip.id} trip={trip} locale={locale} base={base} />
          ))}
        </div>
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
  const { trips } = usePortal();
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
        <PortalButton href={portalHref(locale, base, "new")}>
          <Plus size={18} />
          {t.new}
        </PortalButton>
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
  if (view === "access")
    return (
      <section className="bp-access">
        <Image
          src="/images/sim/sim_traveler.png"
          width={180}
          height={180}
          alt="SIM"
        />
        <span className="bp-eyebrow">MYTRIPSIM BUSINESS</span>
        <h1>{t.accessTitle}</h1>
        <p>{t.accessInfo}</p>
        <PortalButton href={portalHref(locale, base, "home")}>
          {t.explore}
          <ArrowRight size={18} />
        </PortalButton>
        <small>{t.accessNote}</small>
      </section>
    );
  if (view === "team")
    return (
      <>
        <PageHeading title={t.teamTitle} description={t.teamInfo} />
        <div className="bp-trip-grid">
          {[
            { icon: ShieldCheck, title: t.role1, info: t.role1Info },
            { icon: Luggage, title: t.role2, info: t.role2Info },
            { icon: Wallet, title: t.role3, info: t.role3Info },
          ].map(({ icon: Icon, title, info }) => (
            <div className="bp-panel bp-role" key={title}>
              <span className="bp-icon">
                <Icon size={23} />
              </span>
              <h2>{title}</h2>
              <p>{info}</p>
            </div>
          ))}
        </div>
        <div className="bp-detail-actions">
          <PortalButton href={portalHref(locale, base, "billing")} secondary>
            <Wallet size={17} />
            {t.billing}
          </PortalButton>
        </div>
      </>
    );
  if (view === "billing")
    return (
      <>
        <PageHeading title={t.billingTitle} description={t.billingInfo} />
        <div className="bp-panel bp-empty">
          <Wallet size={35} />
          <h2>{t.billing}</h2>
          <p>{t.billingNote}</p>
          <PortalButton href={portalHref(locale, base, "trips")} secondary>
            {t.trips}
            <ArrowRight size={17} />
          </PortalButton>
        </div>
      </>
    );
  return (
    <>
      <PageHeading title={t.helpTitle} />
      <section className="bp-help">
        <Image
          src="/images/sim/sim_help.png"
          width={190}
          height={190}
          alt="SIM"
        />
        <div>
          <span className="bp-eyebrow">{t.business}</span>
          <h2>{t.contact}</h2>
          <p>
            {locale === "es"
              ? "El WhatsApp y el correo de atención empresarial se mostrarán únicamente a miembros autenticados de cada empresa."
              : "Business WhatsApp and email will only be shown to authenticated company members."}
          </p>
          <PortalButton href={portalHref(locale, base, "access")} secondary>
            <ShieldCheck size={18} />
            {t.access}
          </PortalButton>
          <small>{t.accessNote}</small>
        </div>
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
  const { trips } = usePortal();
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
            <strong>{t.company}</strong>
            <small>{t.workspace}</small>
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
          <Link
            href={portalHref(locale, base, "review")}
            className={route.view === "review" ? "bp-nav-active" : ""}
          >
            <ClipboardCheck size={19} />
            <span>{t.review}</span>
            <span className="bp-mini-tag">
              {locale === "es" ? "Ejemplo" : "Example"}
            </span>
          </Link>
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
              AE
            </Link>
          </div>
        </header>
        <main id="portal-content" className="bp-main" tabIndex={-1}>
          <div className="bp-preview">
            <Sparkles size={16} />
            <div>
              <strong>{t.preview}</strong>
              <span>{t.previewDetail}</span>
            </div>
          </div>
          {route.view === "home" ? (
            <Overview locale={locale} base={base} />
          ) : route.view === "trips" ? (
            <Trips locale={locale} base={base} />
          ) : route.view === "new" ? (
            <PortalTripForm locale={locale} base={base} />
          ) : route.view === "review" ? (
            <PortalReview locale={locale} base={base} />
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
      <nav className="bp-mobile-nav" aria-label={t.menu}>
        {[
          { view: "home", icon: House },
          { view: "trips", icon: Luggage },
          { view: "new", icon: Plus },
          { view: "review", icon: ClipboardCheck },
          { view: "help", icon: Headphones },
        ].map(({ view, icon: Icon }) => (
          <Link
            key={view}
            href={portalHref(locale, base, view as PortalView)}
            className={
              route.view === view ||
              (view === "trips" && ["trip", "request"].includes(route.view))
                ? "bp-nav-active"
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
