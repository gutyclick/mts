"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Globe2,
  Info,
  Package,
  Send,
  Users,
  QrCode,
} from "lucide-react";
import { portalCopy, portalHref } from "@/lib/portal/copy";
import type { PortalTrip } from "@/lib/portal/model";
import { canManageTrips } from "@/lib/portal/business";
import { usePortal } from "./portal-state";
import {
  PageHeading,
  PortalButton,
  TripStatus,
  tripDate,
  type PortalProps,
} from "./portal-ui";
export function PortalTripDetail({
  locale,
  base,
  trip,
}: PortalProps & { trip: PortalTrip }) {
  const es = locale === "es",
    t = portalCopy[locale];
  const { company } = usePortal();
  const [section, setSection] = useState<"overview" | "people" | "orders">(
    "overview",
  );
  const order = trip.request ? (
    <div className="bp-order">
      <div>
        <span className="bp-eyebrow">
          {trip.request.id.slice(0, 8).toUpperCase()}
        </span>
        <h3>{trip.request.quantity} eSIM</h3>
        <p>{trip.request.planName ?? trip.request.plan}</p>
        <p>
          {trip.request.days} {es ? "días" : "days"} · {trip.destination}
        </p>
      </div>
      <TripStatus trip={trip} locale={locale} />
      {trip.request.reviewNote && (
        <p className="bp-note">{trip.request.reviewNote}</p>
      )}
      <div className="bp-order-foot">
        <Info size={17} />
        <p>{t.approvalNote}</p>
      </div>
    </div>
  ) : (
    <div className="bp-empty">
      <ClipboardCheck size={28} />
      <p>{t.noOrder}</p>
    </div>
  );
  return (
    <>
      <Link className="bp-back" href={portalHref(locale, base, "trips")}>
        <ArrowLeft size={16} />
        {t.back}
      </Link>
      <PageHeading
        title={trip.name}
        description={`${trip.destination} · ${tripDate(trip.departure, locale)} — ${tripDate(trip.returning, locale, { year: "numeric" })}`}
      >
        <TripStatus trip={trip} locale={locale} />
      </PageHeading>
      <section className="bp-boarding">
        <div className="bp-boarding-main">
          <span className="bp-icon">
            <Globe2 size={24} />
          </span>
          <div>
            <span className="bp-eyebrow">{t.destination}</span>
            <h2>{trip.destination}</h2>
            <p>
              {t[trip.mode]} · {trip.travelers} {t.travelers.toLowerCase()}
            </p>
          </div>
        </div>
        <div className="bp-departure">
          <CalendarDays size={20} />
          <div>
            <small>{t.dateLabel}</small>
            <strong>
              {tripDate(trip.departure, locale, { year: "numeric" })}
            </strong>
          </div>
        </div>
      </section>
      <section className="bp-trip-counts" aria-label={t.distribution}>
        {[
          { label: t.travelers, count: trip.travelers, icon: Users },
          { label: t.assigned, count: trip.assigned, icon: Package },
          { label: t.delivered, count: trip.delivered, icon: Send },
          { label: t.activated, count: trip.activated, icon: CheckCircle2 },
        ].map(({ label, count, icon: Icon }, index) => (
          <div key={label} className={index === 3 ? "bp-count-success" : ""}>
            <Icon size={19} />
            <strong>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>
      {trip.mode === "individual" && (
        <p className="bp-sales-note">
          {t.sold}: <strong>{trip.sold}</strong>
          <span>
            {es
              ? "El registro de ventas y la distribución se conectarán en la fase de entrega."
              : "Sales recording and distribution will be connected in the delivery phase."}
          </span>
        </p>
      )}
      <div className="bp-detail-actions">
        {canManageTrips(company.role) &&
          ["draft", "changes"].includes(trip.status) && (
            <PortalButton href={portalHref(locale, base, "request", trip.id)}>
              <Send size={17} />
              {t.request}
            </PortalButton>
          )}
        {trip.status === "pending" && (
          <p className="bp-note">
            {es
              ? "Tu solicitud está en la cola de revisión del equipo."
              : "Your request is in our team’s review queue."}
          </p>
        )}
      </div>
      <div className="bp-segments" aria-label={t.trip}>
        {(["overview", "people", "orders"] as const).map((view) => (
          <button
            key={view}
            type="button"
            aria-pressed={section === view}
            onClick={() => setSection(view)}
          >
            {t[view]}
          </button>
        ))}
      </div>
      {section === "overview" ? (
        <div className="bp-bottom-grid">
          <section className="bp-panel">
            <div className="bp-section-head">
              <h2>{t.distribution}</h2>
              <Users size={20} />
            </div>
            <p>
              {es
                ? "Todavía no se han emitido eSIM para este viaje. La asignación, los QR y las activaciones aparecerán cuando se conecte la entrega."
                : "No eSIMs have been issued for this trip yet. Assignments, QR codes and activations will appear when delivery is connected."}
            </p>
            <p className="bp-note">
              <Info size={16} />
              {t.providerNote}
            </p>
          </section>
          <section className="bp-panel">
            <div className="bp-section-head">
              <h2>{t.orders}</h2>
              <ClipboardCheck size={20} />
            </div>
            {order}
          </section>
        </div>
      ) : section === "orders" ? (
        <section className="bp-panel">{order}</section>
      ) : (
        <section className="bp-panel bp-empty">
          <QrCode size={30} />
          <h2>
            {es
              ? "Tus viajeros tendrán su espacio aquí"
              : "A place for every traveler"}
          </h2>
          <p>
            {es
              ? "El tamaño del grupo está guardado. Los destinatarios y sus eSIM se añadirán en la fase de distribución; no se crean registros de viajeros ficticios."
              : "Your group size is saved. Recipients and their eSIMs will be added in the distribution phase; no fictional traveler records are created."}
          </p>
        </section>
      )}
      <section className="bp-delivery-note">
        <span className="bp-icon bp-icon-orange">
          <Info size={22} />
        </span>
        <div>
          <h2>
            {es
              ? "Solicitud y emisión son pasos distintos"
              : "Requests and issuance are separate steps"}
          </h2>
          <p>
            {es
              ? "Esta fase guarda y revisa tus solicitudes. No realiza cobros ni emite eSIM automáticamente."
              : "This phase saves and reviews requests. It does not charge you or automatically issue eSIMs."}
          </p>
          <Link
            className="bp-text-link"
            href={portalHref(locale, base, "help")}
          >
            {t.help}
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
    </>
  );
}
