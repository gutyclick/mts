"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Globe2,
  Info,
  Package,
  QrCode,
  Send,
  ShieldCheck,
  Users,
} from "lucide-react";
import { portalCopy, portalHref } from "@/lib/portal/copy";
import {
  requestTrip,
  reviewRequest,
  type PortalTrip,
} from "@/lib/portal/model";
import { usePortal } from "./portal-state";
import {
  ExportButton,
  PageHeading,
  PortalButton,
  TripStatus,
  tripDate,
  type PortalProps,
} from "./portal-ui";

type TripProps = PortalProps & { trip: PortalTrip };

function OrderSummary({ trip, locale, base }: TripProps) {
  const t = portalCopy[locale];
  if (!trip.request)
    return (
      <div className="bp-empty">
        <ClipboardCheck size={30} />
        <p>{t.noOrder}</p>
        <PortalButton href={portalHref(locale, base, "request", trip.id)}>
          {t.request}
          <ArrowRight size={17} />
        </PortalButton>
      </div>
    );
  return (
    <div className="bp-order">
      <div>
        <span className="bp-eyebrow">{trip.request.id}</span>
        <h3>
          {trip.request.quantity} eSIM ·{" "}
          {trip.request.plan.replace("gb", " GB")}
        </h3>
        <p>
          {trip.destination} · {t[trip.mode]}
        </p>
      </div>
      <TripStatus trip={trip} locale={locale} />
      <div className="bp-order-foot">
        <ShieldCheck size={17} />
        <p>{t.approvalNote}</p>
      </div>
    </div>
  );
}

export function PortalTripDetail({ locale, base, trip }: TripProps) {
  const t = portalCopy[locale];
  const [section, setSection] = useState<"overview" | "people" | "orders">(
    "overview",
  );
  const [visible, setVisible] = useState(10);
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
            {locale === "es"
              ? "Registro de la empresa, independiente de la activación."
              : "Recorded by the company, separately from activation."}
          </span>
        </p>
      )}
      <div className="bp-detail-actions">
        {["draft", "changes"].includes(trip.status) && (
          <PortalButton href={portalHref(locale, base, "request", trip.id)}>
            <PlusIcon />
            {t.request}
          </PortalButton>
        )}
        {trip.status === "pending" && (
          <PortalButton href={portalHref(locale, base, "review")} secondary>
            <ClipboardCheck size={18} />
            {t.reviewLink}
          </PortalButton>
        )}
        <ExportButton trip={trip} locale={locale} />
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
            <div className="bp-distribution">
              {[
                { label: t.assigned, value: trip.assigned, tone: "blue" },
                { label: t.delivered, value: trip.delivered, tone: "orange" },
                { label: t.activated, value: trip.activated, tone: "green" },
              ].map(({ label, value, tone }) => (
                <div key={label}>
                  <p>
                    <span>{label}</span>
                    <strong>
                      {value} / {trip.travelers}
                    </strong>
                  </p>
                  <div className={`bp-bar bp-bar-${tone}`}>
                    <span
                      style={{ width: `${(100 * value) / trip.travelers}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
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
            <OrderSummary trip={trip} locale={locale} base={base} />
          </section>
        </div>
      ) : section === "orders" ? (
        <section className="bp-panel">
          <OrderSummary trip={trip} locale={locale} base={base} />
        </section>
      ) : (
        <section className="bp-panel">
          <div className="bp-section-head">
            <h2>{t.people}</h2>
            <span>
              {Math.min(visible, trip.travelers)} / {trip.travelers}
            </span>
          </div>
          <p className="bp-note">{t.exportHint}</p>
          <div className="bp-table-wrap">
            <table className="bp-table">
              <thead>
                <tr>
                  <th scope="col">{t.traveler}</th>
                  <th scope="col">{t.reference}</th>
                  <th scope="col">{t.state}</th>
                </tr>
              </thead>
              <tbody>
                {Array.from(
                  { length: Math.min(visible, trip.travelers) },
                  (_, index) => (
                    <tr key={index}>
                      <td>
                        <span className="bp-person">
                          <span>{String(index + 1).padStart(2, "0")}</span>
                          {t.traveler} {String(index + 1).padStart(2, "0")}
                        </span>
                      </td>
                      <td className="bp-mono">
                        EX-{String(index + 1).padStart(3, "0")}
                      </td>
                      <td>
                        <span
                          className={`bp-status ${index < trip.activated ? "bp-status-ready" : index < trip.assigned ? "bp-status-pending" : "bp-status-draft"}`}
                        >
                          <span />
                          {index < trip.activated
                            ? t.activeState
                            : index < trip.delivered
                              ? t.deliveredState
                              : index < trip.assigned
                                ? t.assignedState
                                : t.unassigned}
                        </span>
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
          {visible < trip.travelers && (
            <button
              type="button"
              className="bp-button bp-button-secondary"
              onClick={() => setVisible((value) => value + 50)}
            >
              {t.showMore}
            </button>
          )}
        </section>
      )}
      <section className="bp-delivery-note">
        <span className="bp-icon bp-icon-orange">
          <QrCode size={24} />
        </span>
        <div>
          <h2>{t.issuance}</h2>
          <p>{t.issuanceInfo}</p>
        </div>
      </section>
    </>
  );
}
function PlusIcon() {
  return (
    <span aria-hidden="true" className="bp-plus">
      +
    </span>
  );
}

export function PortalRequest({ trip, locale, base }: TripProps) {
  const t = portalCopy[locale];
  const { update } = usePortal();
  const router = useRouter();
  const [plan, setPlan] = useState(trip.request?.plan ?? "10gb");
  const [quantity, setQuantity] = useState(trip.travelers);
  const [error, setError] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      update(
        requestTrip(
          trip,
          quantity,
          plan,
          `EX-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
        ),
      );
      router.push(portalHref(locale, base, "trip", trip.id));
    } catch {
      setError(true);
    }
  }
  return (
    <>
      <Link
        className="bp-back"
        href={portalHref(locale, base, "trip", trip.id)}
      >
        <ArrowLeft size={16} />
        {trip.name}
      </Link>
      <PageHeading title={t.requestTitle} description={t.requestInfo} />
      {!["draft", "changes"].includes(trip.status) ? (
        <section className="bp-panel bp-empty">
          <Clock3 size={32} />
          <h2>{t.existingRequest}</h2>
          <TripStatus trip={trip} locale={locale} />
          <PortalButton href={portalHref(locale, base, "trip", trip.id)}>
            {t.details}
            <ArrowRight size={17} />
          </PortalButton>
        </section>
      ) : (
        <div className="bp-form-grid">
          <form className="bp-panel bp-form" onSubmit={submit}>
            <fieldset>
              <legend>{t.capacity}</legend>
              <div className="bp-data-options">
                {["1gb", "5gb", "10gb", "20gb"].map((value) => (
                  <label
                    key={value}
                    className={plan === value ? "bp-data-selected" : ""}
                  >
                    <input
                      type="radio"
                      name="plan"
                      value={value}
                      checked={plan === value}
                      onChange={() => setPlan(value)}
                    />
                    <span>{value.replace("gb", " GB")}</span>
                    {plan === value && <Check size={15} />}
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              {t.quantity}
              <input
                type="number"
                min={1}
                max={trip.travelers}
                step={1}
                required
                value={quantity}
                readOnly={trip.mode === "package"}
                onChange={(event) => setQuantity(Number(event.target.value))}
                inputMode="numeric"
              />
            </label>
            {trip.mode === "package" && (
              <p className="bp-note">
                <Package size={17} />
                {t.fullGroup}
              </p>
            )}
            <p className="bp-note">
              <Info size={17} />
              {t.requestNote}
            </p>
            {error && (
              <p className="bp-error" role="alert">
                {t.requestError}
              </p>
            )}
            <button type="submit" className="bp-button">
              <Send size={17} />
              {t.requestButton}
            </button>
          </form>
          <aside className="bp-form-aside">
            <span className="bp-icon bp-icon-orange">
              <ClipboardCheck size={25} />
            </span>
            <h2>{t.summary}</h2>
            <dl className="bp-summary">
              <div>
                <dt>{t.tripName}</dt>
                <dd>{trip.name}</dd>
              </div>
              <div>
                <dt>{t.destination}</dt>
                <dd>{trip.destination}</dd>
              </div>
              <div>
                <dt>{t.modality}</dt>
                <dd>{t[trip.mode]}</dd>
              </div>
              <div>
                <dt>{t.total}</dt>
                <dd>
                  {Number.isFinite(quantity) ? quantity : 0} eSIM ·{" "}
                  {plan.replace("gb", " GB")}
                </dd>
              </div>
            </dl>
            <p>{t.approvalNote}</p>
          </aside>
        </div>
      )}
    </>
  );
}

export function PortalReview({ locale, base }: PortalProps) {
  const t = portalCopy[locale];
  const { trips, update } = usePortal();
  const [message, setMessage] = useState("");
  const pending = trips.filter((trip) => trip.status === "pending");
  function review(trip: PortalTrip, decision: "approved" | "changes") {
    update(reviewRequest(trip, decision));
    setMessage(t.reviewDone);
  }
  return (
    <>
      <PageHeading title={t.reviewTitle} description={t.reviewInfo} />
      <div className="bp-review-note">
        <ShieldCheck size={20} />
        <p>{t.approvalNote}</p>
      </div>
      {message && (
        <p className="bp-success" role="status">
          <CheckCircle2 size={18} />
          {message}
        </p>
      )}
      {pending.length ? (
        <div className="bp-review-list">
          {pending.map((trip) => (
            <section className="bp-panel" key={trip.id}>
              <div className="bp-section-head">
                <div>
                  <span className="bp-eyebrow">{trip.request?.id}</span>
                  <h2>{trip.name}</h2>
                </div>
                <TripStatus trip={trip} locale={locale} />
              </div>
              <dl className="bp-review-facts">
                <div>
                  <dt>{t.destination}</dt>
                  <dd>{trip.destination}</dd>
                </div>
                <div>
                  <dt>{t.travelers}</dt>
                  <dd>{trip.travelers}</dd>
                </div>
                <div>
                  <dt>{t.total}</dt>
                  <dd>
                    {trip.request?.quantity} eSIM ·{" "}
                    {trip.request?.plan.replace("gb", " GB")}
                  </dd>
                </div>
                <div>
                  <dt>{t.modality}</dt>
                  <dd>{t[trip.mode]}</dd>
                </div>
              </dl>
              <div className="bp-detail-actions">
                <button
                  type="button"
                  className="bp-button"
                  onClick={() => review(trip, "approved")}
                >
                  <Check size={18} />
                  {t.approve}
                </button>
                <button
                  type="button"
                  className="bp-button bp-button-secondary"
                  onClick={() => review(trip, "changes")}
                >
                  {t.returnChanges}
                </button>
                <Link
                  className="bp-text-link"
                  href={portalHref(locale, base, "trip", trip.id)}
                >
                  {t.details}
                  <ArrowRight size={16} />
                </Link>
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="bp-empty">
          <ClipboardCheck size={35} />
          <h2>{t.noPending}</h2>
          <PortalButton href={portalHref(locale, base, "trips")} secondary>
            {t.trips}
            <ArrowRight size={17} />
          </PortalButton>
        </div>
      )}
    </>
  );
}
