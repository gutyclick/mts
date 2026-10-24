"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Info,
  Signal,
  Wifi,
  X,
} from "lucide-react";
import {
  filterPlans,
  getPlans,
  money,
  type Destination,
  type Plan,
} from "@/lib/catalog";
import { dictionaries, type Locale } from "@/lib/i18n";

export function PlanBrowser({
  locale,
  destination,
  initialDays = "",
}: {
  locale: Locale;
  destination: Destination;
  initialDays?: string;
}) {
  const t = dictionaries[locale];
  const id = useId();
  const [data, setData] = useState("");
  const [days, setDays] = useState(
    ["7", "15", "30"].includes(initialDays) ? initialDays : "",
  );
  const [selected, setSelected] = useState<Plan | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const checkoutNotice = useRef<HTMLDivElement>(null);
  const plans = filterPlans(getPlans(destination), data, days);
  useEffect(() => {
    if (!selected) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [selected]);
  useEffect(() => {
    if (checkoutMessage) checkoutNotice.current?.focus();
  }, [checkoutMessage]);
  const close = () => {
    dialog.current?.close();
    setSelected(null);
    setCheckoutMessage(false);
  };
  return (
    <section className="plans-section">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t.demo}</p>
          <h2>{t.plans}</h2>
          <p className="section-description">{t.plansDescription}</p>
        </div>
        <span className="plan-result-count" aria-live="polite">
          {plans.length} {t.planCount}
        </span>
      </div>
      <div className="plan-filters">
        <div className="filter-field">
          <label htmlFor={`${id}-data`}>{t.data}</label>
          <select
            id={`${id}-data`}
            value={data}
            onChange={(event) => setData(event.target.value)}
          >
            <option value="">{t.allData}</option>
            {[1, 3, 5, 10].map((gb) => (
              <option key={gb} value={gb}>
                {gb} GB
              </option>
            ))}
          </select>
        </div>
        <div className="filter-field">
          <label htmlFor={`${id}-days`}>{t.validity}</label>
          <select
            id={`${id}-days`}
            value={days}
            onChange={(event) => setDays(event.target.value)}
          >
            <option value="">{t.allDurations}</option>
            {[7, 15, 30].map((value) => (
              <option key={value} value={value}>
                {value} {t.days}
              </option>
            ))}
          </select>
        </div>
        {(data || days) && (
          <button
            className="reset-button"
            onClick={() => {
              setData("");
              setDays("");
            }}
          >
            {t.reset}
          </button>
        )}
      </div>
      <p className="catalog-disclaimer">
        <Info size={16} />
        {t.demoDetails}
      </p>
      <div className="plans-grid">
        {plans.map((plan) => (
          <article className="plan-card" key={plan.id}>
            <div className="plan-card-top">
              <span className="plan-icon">
                <Wifi size={23} />
              </span>
              <span className="plan-type">{t.demo}</span>
            </div>
            <h3>
              {plan.dataGb} <span>GB</span>
            </h3>
            <p className="plan-validity">
              <CalendarDays size={16} />
              {plan.days} {t.days}
            </p>
            <dl className="plan-specs">
              {[
                [t.network, t.unconfirmed],
                [t.activation, t.unconfirmed],
                [t.topup, t.unconfirmed],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <div className="plan-price">
              <strong>{money(plan.priceUsd, locale)}</strong>
              <span>USD · {t.samplePrice}</span>
            </div>
            <button
              className="button button-secondary"
              onClick={() => {
                setSelected(plan);
                setCheckoutMessage(false);
              }}
            >
              {t.viewPlan}
              <ArrowRight size={17} />
            </button>
          </article>
        ))}
      </div>
      {!plans.length && (
        <div className="empty-state">
          <Signal size={32} />
          <p>{t.planEmpty}</p>
          <button
            className="button button-secondary"
            onClick={() => {
              setData("");
              setDays("");
            }}
          >
            {t.reset}
          </button>
        </div>
      )}
      <dialog
        ref={dialog}
        className="plan-dialog"
        aria-labelledby="plan-dialog-title"
        onCancel={close}
        onClick={(event) => {
          if (event.target === dialog.current) close();
        }}
        onClose={() => {
          setSelected(null);
          setCheckoutMessage(false);
        }}
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
            <span className="plan-icon">
              <Wifi size={28} />
            </span>
            <p className="eyebrow">
              {t.details} · {t.demo}
            </p>
            <h2 id="plan-dialog-title">
              {destination.name[locale]} · {selected.dataGb} GB
            </h2>
            <p>{t.dataOnly}</p>
            <div className="dialog-data">
              <span>
                <Check size={17} />
                {selected.dataGb} GB
              </span>
              <span>
                <CalendarDays size={17} />
                {selected.days} {t.days}
              </span>
            </div>
            <dl className="plan-specs">
              {[
                [t.network, t.unconfirmed],
                [t.activation, t.unconfirmed],
                [t.topup, t.unconfirmed],
                [t.coverage, destination.coverage[locale]],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p className="dialog-price">
              {money(selected.priceUsd, locale)}{" "}
              <span>USD · {t.samplePrice}</span>
            </p>
            <p className="dialog-disclaimer">{t.demoDetails}</p>
            {checkoutMessage ? (
              <div
                ref={checkoutNotice}
                tabIndex={-1}
                className="checkout-notice"
                role="status"
              >
                <Info size={20} />
                <div>
                  <strong>{t.checkout}</strong>
                  <p>{t.checkoutBody}</p>
                </div>
              </div>
            ) : (
              <button
                className="button button-primary full-width"
                onClick={() => setCheckoutMessage(true)}
              >
                {t.checkout}
                <Info size={17} />
              </button>
            )}
            <button className="dialog-back" onClick={close}>
              {t.gotIt}
            </button>
          </>
        )}
      </dialog>
    </section>
  );
}
