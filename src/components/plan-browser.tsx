"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, SlidersHorizontal, Wifi } from "lucide-react";
import type { Destination } from "@/lib/catalog";
import { filterPlans, sortPlans, type Plan } from "@/lib/plan-utils";
import { type Locale, pathFor } from "@/lib/i18n";
import { catalogCopy } from "@/lib/catalog-copy";
import { PlanPurchaseSummary } from "./experience/plan-purchase-summary";
import { planVariant } from "@/lib/plan-variants";
import { Price } from "@/components/price";

export type CuratedBrowserCatalog = {
  modes: Array<{
    id: string;
    label: { es: string; en: string };
    description: { es: string; en: string };
    secondaryPlans?: Plan[];
    plans: Array<{
      plan: Plan;
      category: "basic" | "essential" | "plus" | "max";
      recommended: boolean;
      reasons: string[];
    }>;
  }>;
  defaultMode: string;
};
type BrowserProps = {
  locale: Locale;
  destination: Destination;
  availablePlans: Plan[];
  initialDays?: string;
  initialPlanId?: string;
  curatedCatalog?: CuratedBrowserCatalog;
};
export function PlanBrowser(props: BrowserProps) {
  return props.curatedCatalog ? (
    <CuratedPlanBrowser {...props} catalog={props.curatedCatalog} />
  ) : (
    <LegacyPlanBrowser {...props} />
  );
}
function CuratedPlanBrowser({
  locale,
  destination,
  initialPlanId = "",
  catalog,
}: BrowserProps & { catalog: CuratedBrowserCatalog }) {
  const es = locale === "es";
  const id = useId();
  const initialMode =
    catalog.modes.find(
      (mode) =>
        mode.plans.some(({ plan }) => plan.id === initialPlanId) ||
        mode.secondaryPlans?.some((plan) => plan.id === initialPlanId),
    ) ??
    catalog.modes.find((mode) => mode.id === catalog.defaultMode) ??
    catalog.modes[0];
  const [modeId, setModeId] = useState(initialMode?.id ?? "");
  const [selectedId, setSelectedId] = useState(initialPlanId);
  const mode = catalog.modes.find((item) => item.id === modeId) ?? initialMode;
  const candidates = mode?.plans ?? [];
  const secondaryPlans = mode?.secondaryPlans ?? [];
  const selectedEntry = candidates.find(({ plan }) => plan.id === selectedId);
  const selected =
    selectedEntry?.plan ??
    secondaryPlans.find((plan) => plan.id === selectedId) ??
    candidates[0]?.plan ??
    secondaryPlans[0];
  const labels = es
    ? { basic: "Básico", essential: "Esencial", plus: "Plus", max: "Max" }
    : { basic: "Basic", essential: "Essential", plus: "Plus", max: "Max" };
  const descriptions = es
    ? {
        basic: "Para mapas y mensajes",
        essential: "Para tu día a día de viaje",
        plus: "Para compartir más momentos",
        max: "Para un uso más intenso",
      }
    : {
        basic: "For maps and messages",
        essential: "For everyday travel",
        plus: "For sharing more moments",
        max: "For heavier data use",
      };
  function choose(plan: Plan | undefined) {
    setSelectedId(plan?.id ?? "");
    const query = new URLSearchParams(window.location.search);
    if (plan) query.set("plan", plan.id);
    else query.delete("plan");
    query.delete("days");
    const suffix = query.toString();
    window.history.replaceState(
      null,
      "",
      pathFor(locale, undefined, destination.slug) +
        (suffix ? "?" + suffix : ""),
    );
  }
  return (
    <section
      className="plan-browser curated-plan-browser"
      aria-label={es ? "Planes y ficha completa" : "Plans and full details"}
    >
      <div className="plan-workspace">
        <div className="plan-selector">
          <header className="plan-selector-heading">
            <h2>{es ? "Elige tu plan" : "Choose your plan"}</h2>
          </header>
          {catalog.modes.length > 1 && (
            <fieldset className="curated-mode-switch">
              <legend>{es ? "Tipo de plan" : "Plan type"}</legend>
              {catalog.modes.map((item) => (
                <label key={item.id} data-selected={item.id === mode?.id}>
                  <input
                    type="radio"
                    name={id + "-mode"}
                    value={item.id}
                    checked={item.id === mode?.id}
                    onChange={() => {
                      const next =
                        item.plans.find(
                          (entry) => entry.category === selectedEntry?.category,
                        ) ?? item.plans[0];
                      setModeId(item.id);
                      choose(next?.plan ?? item.secondaryPlans?.[0]);
                    }}
                  />
                  <span>{item.label[locale]}</span>
                </label>
              ))}
            </fieldset>
          )}
          {mode && (
            <p className="curated-mode-description">
              {mode.description[locale]}
            </p>
          )}
          <fieldset className="curated-plan-options">
            <legend className="sr-only">
              {es ? "Selecciona tu plan" : "Select your plan"}
            </legend>
            {candidates.map(({ plan, category, recommended }) => (
              <label
                className="curated-plan-card"
                key={plan.id}
                data-plan-id={plan.id}
                data-selected={plan.id === selected?.id}
              >
                <input
                  type="radio"
                  name={id + "-plan"}
                  value={plan.id}
                  checked={plan.id === selected?.id}
                  aria-controls={id + "-details"}
                  onChange={() => choose(plan)}
                />
                <span className="curated-plan-card-heading">
                  <strong>{labels[category]}</strong>
                  {recommended && category === "essential" && (
                    <span className="curated-recommendation">
                      {es ? "Recomendado" : "Recommended"}
                    </span>
                  )}
                </span>
                <span className="curated-plan-allowance">{plan.allowance}</span>
                <span className="curated-plan-duration">
                  {plan.days}{" "}
                  {es
                    ? plan.days === 1
                      ? "día"
                      : "días"
                    : plan.days === 1
                      ? "day"
                      : "days"}
                </span>
                <span className="curated-plan-description">
                  {descriptions[category]}
                </span>
                <span className="curated-plan-price">
                  {plan.retailPriceCents != null && (
                    <Price cents={plan.retailPriceCents} locale={locale} />
                  )}
                  <span className="plan-option-check" aria-hidden="true">
                    {selected?.id === plan.id && <Check size={14} />}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
          {secondaryPlans.length > 0 && (
            <details className="curated-long-stays" key={mode?.id}>
              <summary>{es ? "Estancias largas" : "Longer stays"}</summary>
              <fieldset>
                <legend className="sr-only">
                  {es
                    ? "Planes para estancias largas"
                    : "Plans for longer stays"}
                </legend>
                {secondaryPlans.map((plan) => (
                  <label
                    className="curated-long-stay-option"
                    key={plan.id}
                    data-plan-id={plan.id}
                    data-selected={plan.id === selected?.id}
                  >
                    <input
                      type="radio"
                      name={id + "-plan"}
                      value={plan.id}
                      checked={plan.id === selected?.id}
                      aria-controls={id + "-details"}
                      onChange={() => choose(plan)}
                    />
                    <strong>{plan.allowance}</strong>
                    <span>
                      {plan.days} {es ? "días" : "days"}
                    </span>
                    {plan.retailPriceCents != null && (
                      <strong className="curated-long-stay-price">
                        <Price cents={plan.retailPriceCents} locale={locale} />
                      </strong>
                    )}
                  </label>
                ))}
              </fieldset>
            </details>
          )}
          {!candidates.length && !secondaryPlans.length && (
            <p className="empty-state">
              {es
                ? "No hay planes disponibles en este momento."
                : "No plans are available right now."}
            </p>
          )}
        </div>
        <div
          id={id + "-details"}
          className="selected-plan-panel"
          role={selected ? "region" : undefined}
          aria-label={es ? "Ficha completa del plan" : "Full plan details"}
        >
          {selected && (
            <PlanPurchaseSummary
              locale={locale}
              destination={destination}
              plan={selected}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function LegacyPlanBrowser({
  locale,
  destination,
  availablePlans,
  initialDays = "",
  initialPlanId = "",
}: {
  locale: Locale;
  destination: Destination;
  availablePlans: Plan[];
  initialDays?: string;
  initialPlanId?: string;
}) {
  const c = catalogCopy[locale];
  const es = locale === "es";
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
  const [order, setOrder] = useState<"data" | "days">("data");
  const [selectedId, setSelectedId] = useState(initialPlanId);
  const options = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (!initialPlanId) return;
    const list = options.current;
    const row = list
      ?.querySelector<HTMLInputElement>("input:checked")
      ?.closest("label");
    if (list && row)
      list.scrollTop +=
        row.getBoundingClientRect().top - list.getBoundingClientRect().top - 5;
  }, [initialPlanId]);
  const plans = sortPlans(filterPlans(availablePlans, data, days), order);
  const allSorted = sortPlans(availablePlans);
  const selected = plans.find((plan) => plan.id === selectedId) ?? plans[0];
  function updateUrl(plan: Plan | undefined, duration: string) {
    const query = new URLSearchParams(window.location.search);
    if (plan) query.set("plan", plan.id);
    else query.delete("plan");
    if (duration) query.set("days", duration);
    else query.delete("days");
    const suffix = query.toString();
    window.history.replaceState(
      null,
      "",
      `${pathFor(locale, undefined, destination.slug)}${suffix ? `?${suffix}` : ""}`,
    );
  }
  function filter(nextData: string, nextDays: string) {
    setData(nextData);
    setDays(nextDays);
    const next = sortPlans(
      filterPlans(availablePlans, nextData, nextDays),
      order,
    );
    const active = next.find((plan) => plan.id === selected?.id) ?? next[0];
    setSelectedId(active?.id ?? "");
    updateUrl(active, nextDays);
  }
  return (
    <section
      className="plan-browser"
      aria-label={es ? "Planes y ficha completa" : "Plans and full details"}
    >
      <div
        role={selected ? "region" : undefined}
        aria-label={
          selected
            ? es
              ? "Ficha completa del plan"
              : "Full plan details"
            : undefined
        }
      >
        <div className="plan-workspace">
          <div className="plan-selector">
            <header className="plan-selector-heading">
              <h2>{es ? "Elige tu plan" : "Choose your plan"}</h2>
              <span aria-live="polite">
                {plans.length} {plans.length === 1 ? c.plan : c.plans}
              </span>
            </header>
            <div className="plan-controls">
              <label htmlFor={`${id}-sort`}>
                <SlidersHorizontal size={15} />
                {es ? "Ordenar por" : "Sort by"}
              </label>
              <select
                id={`${id}-sort`}
                value={order}
                onChange={(event) =>
                  setOrder(event.target.value as "data" | "days")
                }
              >
                <option value="data">
                  {es ? "GB: de menos a más" : "GB: low to high"}
                </option>
                <option value="days">
                  {es ? "Días: de menos a más" : "Days: low to high"}
                </option>
              </select>
              <details className="plan-filter-disclosure">
                <summary>
                  {es ? "Filtrar por GB o d\u00edas" : "Filter data or days"}
                </summary>
                <div className="plan-compact-filters">
                  <div>
                    <label htmlFor={`${id}-data`}>{c.data}</label>
                    <select
                      id={`${id}-data`}
                      value={data}
                      onChange={(event) => filter(event.target.value, days)}
                    >
                      <option value="">{es ? "Todos" : "Any"}</option>
                      {allowances.map(([gb, label]) => (
                        <option key={gb} value={gb}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor={`${id}-days`}>{c.duration}</label>
                    <select
                      id={`${id}-days`}
                      value={days}
                      onChange={(event) => filter(data, event.target.value)}
                    >
                      <option value="">{es ? "Todos" : "Any"}</option>
                      {durations.map((duration) => (
                        <option key={duration} value={duration}>
                          {duration} {duration === 1 ? c.day : c.days}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </details>
              {(data || days) && (
                <button className="reset-button" onClick={() => filter("", "")}>
                  {c.reset}
                </button>
              )}
            </div>
            {plans.length ? (
              <fieldset ref={options} className="plan-options">
                <legend className="sr-only">
                  {es ? "Selecciona GB y días" : "Select data and duration"}
                </legend>
                {plans.map((plan) => {
                  const variants = allSorted.filter(
                    (item) =>
                      item.dataGb === plan.dataGb && item.days === plan.days,
                  );
                  const variant = planVariant(plan, locale);
                  return (
                    <label
                      className="plan-option"
                      key={plan.id}
                      data-plan-id={plan.id}
                      data-selected={selected?.id === plan.id}
                    >
                      <input
                        type="radio"
                        name={`${id}-plan`}
                        value={plan.id}
                        checked={selected?.id === plan.id}
                        aria-controls={`${id}-details`}
                        onChange={() => {
                          setSelectedId(plan.id);
                          updateUrl(plan, days);
                        }}
                      />
                      <Wifi size={20} aria-hidden="true" />
                      <span className="plan-option-data">
                        <strong>{plan.allowance}</strong>
                        {(variants.length > 1 ||
                          !["Estándar", "Standard"].includes(
                            variant.label,
                          )) && (
                          <small title={variant.description}>
                            {variant.label}
                          </small>
                        )}
                      </span>
                      <span className="plan-validity">
                        {plan.retailPriceCents != null && (
                          <strong className="plan-option-price">
                            {
                              <Price
                                cents={plan.retailPriceCents}
                                locale={locale}
                              />
                            }
                          </strong>
                        )}{" "}
                        <span className="plan-option-duration">
                          {plan.days} {plan.days === 1 ? c.day : c.days}
                        </span>
                      </span>
                      <span className="plan-option-check" aria-hidden="true">
                        {selected?.id === plan.id && <Check size={14} />}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            ) : (
              <div className="empty-state">
                <Wifi size={25} />
                <p>{c.empty}</p>
                <button
                  className="button button-secondary"
                  onClick={() => filter("", "")}
                >
                  {c.reset}
                </button>
              </div>
            )}
          </div>
          <div id={`${id}-details`} className="selected-plan-panel">
            {selected ? (
              <PlanPurchaseSummary
                locale={locale}
                destination={destination}
                plan={selected}
              />
            ) : (
              <div className="plan-selection-empty">
                <Wifi size={30} />
                <h2>{es ? "Encuentra tu plan" : "Find your plan"}</h2>
                <p>
                  {es
                    ? "Prueba otros filtros para ver la ficha completa."
                    : "Try other filters to see full plan details."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
