"use client";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpRight,
  CalendarDays,
  Globe2,
  Users,
} from "lucide-react";
import { portalCopy, portalHref, type PortalLocale } from "@/lib/portal/copy";
import type { PortalTrip } from "@/lib/portal/model";
export type PortalProps = { locale: PortalLocale; base: string };
export function tripDate(
  value: string,
  locale: PortalLocale,
  options?: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
    ...options,
  }).format(new Date(`${value}T12:00:00Z`));
}
export function TripStatus({
  trip,
  locale,
}: {
  trip: PortalTrip;
  locale: PortalLocale;
}) {
  const t = portalCopy[locale];
  return (
    <span className={`bp-status bp-status-${trip.status}`}>
      <span />
      {trip.status === "pending" ? t.pendingStatus : t[trip.status]}
    </span>
  );
}
export function PortalButton({
  href,
  children,
  secondary = false,
}: {
  href: string;
  children: React.ReactNode;
  secondary?: boolean;
}) {
  return (
    <Link
      className={`bp-button${secondary ? " bp-button-secondary" : ""}`}
      href={href}
    >
      {children}
    </Link>
  );
}
export function TripCard({
  trip,
  locale,
  base,
}: PortalProps & { trip: PortalTrip }) {
  const t = portalCopy[locale];
  return (
    <Link
      className="bp-trip-card"
      href={portalHref(locale, base, "trip", trip.id)}
    >
      <div className="bp-trip-top">
        <div className="bp-destination">
          <Globe2 size={19} />
          <span>{trip.destination}</span>
        </div>
        <TripStatus trip={trip} locale={locale} />
      </div>
      <h3>{trip.name}</h3>
      <p className="bp-trip-dates">
        <CalendarDays size={15} />
        {tripDate(trip.departure, locale)} —{" "}
        {tripDate(trip.returning, locale, { year: "numeric" })}
      </p>
      <div className="bp-trip-bottom">
        <span>
          <Users size={16} />
          {trip.travelers} {t.travelers.toLowerCase()}
        </span>
        <span>{t[trip.mode]}</span>
      </div>
      <div
        className="bp-trip-progress"
        aria-label={`${trip.activated}/${trip.travelers} ${t.activated}`}
      >
        <span
          style={{ width: `${(100 * trip.activated) / trip.travelers}%` }}
        />
      </div>
      <div className="bp-trip-caption">
        <span>
          {trip.activated}/{trip.travelers} {t.activated.toLowerCase()}
        </span>
        <ArrowUpRight size={18} />
      </div>
    </Link>
  );
}

export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="bp-page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children}
    </div>
  );
}

export function downloadTravelers(trip: PortalTrip, locale: PortalLocale) {
  const t = portalCopy[locale];
  const rows = [
    [t.reference, t.state],
    ...Array.from({ length: trip.travelers }, (_, index) => [
      `EX-${String(index + 1).padStart(3, "0")}`,
      index < trip.activated
        ? t.activeState
        : index < trip.delivered
          ? t.deliveredState
          : index < trip.assigned
            ? t.assignedState
            : t.unassigned,
    ]),
  ];
  const csv =
    "\uFEFF" +
    rows
      .map((row) =>
        row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","),
      )
      .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "mytripsim-example-travelers.csv";
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportButton({
  trip,
  locale,
}: {
  trip: PortalTrip;
  locale: PortalLocale;
}) {
  const t = portalCopy[locale];
  return (
    <button
      type="button"
      className="bp-button bp-button-secondary"
      onClick={() => downloadTravelers(trip, locale)}
    >
      <ArrowDownToLine size={17} />
      {t.export}
    </button>
  );
}
