"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarDays, Info, Wifi, X } from "lucide-react";
import { planPath } from "@/lib/experience-routes";
import { experienceCopy } from "@/lib/experience-copy";
import type { Destination } from "@/lib/catalog";
import { filterPlans, type Plan } from "@/lib/plan-utils";
import { dictionaries, type Locale } from "@/lib/i18n";
import { catalogCopy } from "@/lib/catalog-copy";
import { DestinationFlag } from "./destination-flag";

export function PlanBrowser({
  locale,
  destination,
  availablePlans,
  initialDays = "",
}: {
  locale: Locale;
  destination: Destination;
  availablePlans: Plan[];
  initialDays?: string;
}) {
  const t = dictionaries[locale];
  const c = catalogCopy[locale];
  const id = useId();
  const durations = [...new Set(availablePlans.map((plan) => plan.days))].sort(
    (a, b) => a - b,
  );
  const allowances = [
    ...new Map(
      availablePlans.map((plan) => [plan.dataGb, plan.allowance]),
    ).entries(),
  ].sort((a, b) => a[0] - b[0]);
  const [data, setData] = useState("");
  const [days, setDays] = useState(
    durations.includes(Number(initialDays)) ? initialDays : "",
  );
  const [selected, setSelected] = useState<Plan | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const plans = filterPlans(availablePlans, data, days);
  useEffect(() => {
    if (!selected) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [selected]);
  const close = () => {
    dialog.current?.close();
    setSelected(null);
  };
  const reset = () => {
    setData("");
    setDays("");
  };
  return (
    <section className="plans-section catalog-browser">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{destination.name[locale]}</p>
          <h2>{t.plans}</h2>
          <p className="section-description">{t.plansDescription}</p>
        </div>
        <span className="plan-result-count" aria-live="polite">
          {plans.length} {plans.length === 1 ? c.plan : c.plans}
        </span>
      </div>
      <div className="plan-filters">
        <div className="filter-field">
          <label htmlFor={`${id}-data`}>{c.data}</label>
          <select
            id={`${id}-data`}
            value={data}
            onChange={(event) => setData(event.target.value)}
          >
            <option value="">{c.allData}</option>
            {allowances.map(([gb, label]) => (
              <option key={gb} value={gb}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label htmlFor={`${id}-days`}>{c.duration}</label>
          <select
            id={`${id}-days`}
            value={days}
            onChange={(event) => setDays(event.target.value)}
          >
            <option value="">{c.allDurations}</option>
            {durations.map((duration) => (
              <option key={duration} value={duration}>
                {duration} {duration === 1 ? c.day : c.days}
              </option>
            ))}
          </select>
        </div>
        {(data || days) && (
          <button className="reset-button" onClick={reset}>
            {c.reset}
          </button>
        )}
      </div>
      {plans.length > 0 ? (
        <div className="plan-group">
          <div className="plan-group-heading">
            <h3>
              {c.fixed}
              <span>{plans.length}</span>
            </h3>
            <p>{c.fixedDescription}</p>
          </div>
          <div className="plans-grid">
            {plans.map((plan) => (
              <article
                className="plan-card"
                key={plan.id}
                data-plan-id={plan.id}
              >
                <div className="plan-card-top">
                  <span className="plan-icon">
                    <Wifi size={23} />
                  </span>
                  <span className="plan-type">{c.fixed}</span>
                </div>
                <p className="plan-name">{plan.name}</p>
                <h3>{plan.allowance}</h3>
                <p className="plan-validity">
                  <CalendarDays size={16} />
                  {plan.days} {plan.days === 1 ? c.day : c.days}
                </p>
                <div className="plan-destination">
                  <DestinationFlag destination={destination} />
                  <span>{destination.name[locale]}</span>
                </div>
                <button
                  className="button button-secondary"
                  onClick={() => setSelected(plan)}
                >
                  {c.details}
                  <ArrowRight size={17} />
                </button>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <Wifi size={28} />
          <p>{c.empty}</p>
          <button className="button button-secondary" onClick={reset}>
            {c.reset}
          </button>
        </div>
      )}
      <p className="catalog-disclaimer">
        <Info size={16} />
        {c.sourceNote}
      </p>
      <dialog
        ref={dialog}
        className="plan-dialog catalog-dialog"
        aria-labelledby="plan-dialog-title"
        onCancel={close}
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
        onClose={() => setSelected(null)}
      >
        {selected && (
          <>
            <button
              className="icon-button dialog-close"
              onClick={close}
              aria-label={t.close}
            >
              <X size={21} />
            </button>
            <DestinationFlag destination={destination} />
            <p className="eyebrow">{t.details}</p>
            <h2 id="plan-dialog-title">{selected.name}</h2>
            <div className="dialog-data">
              <span>
                <Wifi size={17} />
                {selected.allowance}
              </span>
              <span>
                <CalendarDays size={17} />
                {selected.days} {selected.days === 1 ? c.day : c.days}
              </span>
            </div>
            <dl className="plan-specs">
              {[
                [c.destination, destination.name[locale]],
                [
                  c.coverageType,
                  destination.type === "region" ? c.region : c.country,
                ],
                [c.planType, c.fixed],
                [c.planName, selected.name],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="dialog-disclaimer">{c.sourceNote}</p>
            <Link
              className="button button-primary full-width plan-full-details"
              href={planPath(locale, destination.slug, selected.id)}
            >
              {experienceCopy[locale].fullDetails}
              <ArrowRight size={17} />
            </Link>
            <button
              className="button button-primary full-width"
              onClick={close}
            >
              {c.back}
            </button>
          </>
        )}
      </dialog>
    </section>
  );
}
