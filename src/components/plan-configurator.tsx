"use client";

import { useId, useState, type KeyboardEvent } from "react";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  SlidersHorizontal,
  Wifi,
} from "lucide-react";
import type { Destination } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n";
import { pathFor } from "@/lib/i18n";
import type { Plan } from "@/lib/plan-utils";
import { connectivityMode } from "@/lib/catalog-curation";
import {
  buildPlanFamilies,
  availableDurationOptions,
  availableVariantOptions,
  resolvePlanSelection,
  selectDefaultPlan,
  type PlanFamily,
} from "@/lib/plan-selection";
import { PlanPurchaseSummary } from "./experience/plan-purchase-summary";
import { PlanVariant } from "./plan-variant";
import { Price } from "./price";
import "@/styles/plan-configurator.css";

export function PlanConfigurator({
  locale,
  destination,
  plans,
  initialPlanId = "",
  initialDays = "",
}: {
  locale: Locale;
  destination: Destination;
  plans: Plan[];
  initialPlanId?: string;
  initialDays?: string;
}) {
  const es = locale === "es",
    id = useId();
  const families = buildPlanFamilies(plans);
  const defaultPool = plans.some((p) => p.dataGb >= 1)
    ? plans.filter((p) => p.dataGb >= 1)
    : plans;
  const initial =
    initialPlanId && plans.some((p) => p.id === initialPlanId)
      ? selectDefaultPlan(plans, initialPlanId)
      : selectDefaultPlan(
          defaultPool,
          undefined,
          /^\d+$/.test(initialDays) ? Number(initialDays) : undefined,
        );
  const [selection, setSelection] = useState(initial?.id ?? "");
  const [notice, setNotice] = useState("");
  const selected = plans.find((p) => p.id === selection) ?? initial;
  const mode = selected ? connectivityMode(selected) : "standard";
  const durations = selected
    ? availableDurationOptions(plans, selected.dataGb, mode)
    : [];
  const dayButtons = [...new Set([7, 15, 30, ...durations])].sort(
    (a, b) => a - b,
  );
  const variants = selected
    ? availableVariantOptions(plans, selected.dataGb, selected.days).filter(
        (v) => v.id !== "standard",
      )
    : [];
  const base = selected
    ? resolvePlanSelection(plans, {
        dataGb: selected.dataGb,
        days: selected.days,
        mode: "standard",
      })
    : undefined;
  const main = families.filter((f) => f.dataGb >= 1),
    small = families.filter((f) => f.dataGb < 1);
  function radioKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (
      ![
        "ArrowRight",
        "ArrowLeft",
        "ArrowDown",
        "ArrowUp",
        "Home",
        "End",
      ].includes(event.key)
    )
      return;
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>(
        'button[role="radio"]:not(:disabled)',
      ),
    );
    const index = buttons.findIndex((b) => b === event.target);
    if (index < 0 || !buttons.length) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? buttons.length - 1
          : (index +
              (["ArrowRight", "ArrowDown"].includes(event.key) ? 1 : -1) +
              buttons.length) %
            buttons.length;
    buttons[next].focus();
    buttons[next].click();
  }
  function choose(plan: Plan | undefined, message = "") {
    if (!plan) return;
    setSelection(plan.id);
    setNotice(message);
    const query = new URLSearchParams(window.location.search);
    query.set("plan", plan.id);
    query.delete("days");
    window.history.replaceState(
      null,
      "",
      `${pathFor(locale, undefined, destination.slug)}?${query}`,
    );
  }
  function chooseFamily(family: PlanFamily) {
    const next =
      resolvePlanSelection(plans, {
        dataGb: family.dataGb,
        days: selected?.days,
        mode,
      }) ??
      resolvePlanSelection(plans, { dataGb: family.dataGb, mode }) ??
      resolvePlanSelection(plans, {
        dataGb: family.dataGb,
        mode: "standard",
      }) ??
      family.plans[0];
    const changed =
      selected &&
      (next.days !== selected.days || connectivityMode(next) !== mode);
    choose(
      next,
      changed
        ? es
          ? `Selección actualizada: ${next.allowance} · ${next.days} días${connectivityMode(next) !== mode ? " · " + (connectivityMode(next) === "standard" ? "Estándar" : connectivityMode(next).toUpperCase()) : ""}.`
          : `Selection updated: ${next.allowance} · ${next.days} days${connectivityMode(next) !== mode ? " · " + (connectivityMode(next) === "standard" ? "Standard" : connectivityMode(next).toUpperCase()) : ""}.`
        : "",
    );
  }
  function card(family: PlanFamily) {
    // The from-price and minimum duration describe real options, not an invented GB/day combination.
    const options = family.plans.filter((p) => connectivityMode(p) === mode);
    const shown = options.length
      ? options
      : family.plans.filter((p) => connectivityMode(p) === "standard");
    const priced = shown.length ? shown : family.plans;
    const firstDays = Math.min(...priced.map((p) => p.days)),
      fromPrice = Math.min(...priced.map((p) => p.retailPriceCents!));
    return (
      <button
        key={family.dataGb}
        type="button"
        role="radio"
        aria-checked={selected?.dataGb === family.dataGb}
        className="pc-data-card"
        onClick={() => chooseFamily(family)}
      >
        <span className="pc-card-top">
          <strong>{family.allowance}</strong>
          <span className="pc-check" aria-hidden="true">
            {selected?.dataGb === family.dataGb && <Check size={13} />}
          </span>
        </span>
        <span>
          {es ? "Desde" : "From"} {firstDays} {es ? "días" : "days"}
        </span>
        <span className="pc-card-price">
          {es ? "Desde" : "From"} <Price cents={fromPrice} locale={locale} />
        </span>
      </button>
    );
  }
  if (!families.length)
    return (
      <section className="empty-state">
        <h2>
          {es
            ? "Estamos revisando los planes de este destino"
            : "We are reviewing plans for this destination"}
        </h2>
        <p>
          {es
            ? "Elige otro destino mientras verificamos su disponibilidad."
            : "Choose another destination while we verify availability."}
        </p>
      </section>
    );
  return (
    <section
      className="plan-browser plan-configurator"
      aria-label={es ? "Configura tu eSIM" : "Configure your eSIM"}
    >
      <div className="pc-workspace">
        <div className="pc-selector">
          <header className="pc-heading">
            <span className="pc-heading-icon">
              <SlidersHorizontal size={20} />
            </span>
            <div>
              <h2>{es ? "A tu viaje, a tu medida" : "Made for your trip"}</h2>
              <p>
                {es
                  ? "Elige tus datos y cuánto tiempo los necesitas."
                  : "Choose your data and how long you need it."}
              </p>
            </div>
          </header>
          <fieldset className="pc-section">
            <legend>
              <span className="pc-step">1</span>
              <Wifi size={17} />
              {es ? "¿Cuántos datos?" : "How much data?"}
            </legend>
            <div
              className="pc-data-grid"
              role="radiogroup"
              onKeyDown={radioKeys}
              aria-label={es ? "Cantidad de datos" : "Data allowance"}
            >
              {main.map(card)}
            </div>
            {!!small.length && (
              <details
                className="pc-small-options"
                open={selected ? selected.dataGb < 1 : undefined}
              >
                <summary>
                  {es ? "Solo necesitas un poco" : "Just a little data"}
                  <ChevronDown size={15} />
                </summary>
                <div
                  className="pc-data-grid"
                  role="radiogroup"
                  onKeyDown={radioKeys}
                  aria-label={es ? "Planes pequeños" : "Small data plans"}
                >
                  {small.map(card)}
                </div>
              </details>
            )}
          </fieldset>
          <fieldset className="pc-section">
            <legend>
              <span className="pc-step">2</span>
              <CalendarDays size={17} />
              {es ? "¿Cuántos días?" : "How many days?"}
            </legend>
            <div
              className="pc-duration-grid"
              role="radiogroup"
              onKeyDown={radioKeys}
              aria-label={es ? "Duración del plan" : "Plan duration"}
            >
              {dayButtons.map((days) => {
                const available = durations.includes(days);
                return (
                  <button
                    key={days}
                    type="button"
                    role="radio"
                    aria-checked={selected?.days === days}
                    disabled={!available}
                    title={
                      !available
                        ? es
                          ? "No hay esta duración para la selección actual"
                          : "This duration is not offered for the current selection"
                        : undefined
                    }
                    onClick={() =>
                      selected &&
                      choose(
                        resolvePlanSelection(plans, {
                          dataGb: selected.dataGb,
                          days,
                          mode,
                        }),
                      )
                    }
                  >
                    {days}
                    <span>{es ? "días" : "days"}</span>
                  </button>
                );
              })}
            </div>
            {!durations.includes(15) && (
              <p className="pc-help">
                {es
                  ? "15 días no está disponible para esta selección."
                  : "15 days is not available for this selection."}
              </p>
            )}
          </fieldset>
          {!!variants.length && (
            <fieldset className="pc-section pc-variants">
              <legend>
                <span className="pc-step">3</span>
                {es ? "Personaliza tu conexión" : "Personalize your connection"}
              </legend>
              <p className="pc-help">
                {base
                  ? es
                    ? "Opcional. El precio y la red se actualizan al elegir una variante."
                    : "Optional. Your price and network update with your choice."
                  : es
                    ? "Esta combinación solo se ofrece con conectividad especial."
                    : "This combination is only offered with special connectivity."}
              </p>
              {variants.map((variant) => {
                const candidate = resolvePlanSelection(plans, {
                  dataGb: selected!.dataGb,
                  days: selected!.days,
                  mode: variant.id,
                });
                if (!candidate) return null;
                const checked = mode === variant.id,
                  canDisable = !!base;
                return (
                  <div
                    className="pc-variant-row"
                    key={variant.id}
                    data-selected={checked}
                  >
                    <div>
                      <PlanVariant plan={candidate} locale={locale} />
                      <span className="pc-variant-price">
                        <Price
                          cents={candidate.retailPriceCents!}
                          locale={locale}
                        />{" "}
                        <small>{es ? "total del plan" : "plan total"}</small>
                      </span>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={checked}
                      aria-label={`${es ? "Usar" : "Use"} ${variant.id.toUpperCase()}`}
                      disabled={checked && !canDisable}
                      aria-describedby={id + "-variant-note"}
                      className="pc-switch"
                      onClick={() => choose(checked ? base : candidate)}
                    >
                      <span />
                    </button>
                  </div>
                );
              })}
              <small id={id + "-variant-note"} className="pc-help">
                {es
                  ? "Una variante por eSIM. Consulta sus condiciones con el icono de información."
                  : "One variant per eSIM. Use the info icon to check its conditions."}
              </small>
            </fieldset>
          )}
          <p className="pc-selection-status" role="status" aria-live="polite">
            {notice || "\u00a0"}
          </p>
        </div>
        <div className="selected-plan-panel pc-summary" id={id + "-summary"}>
          {selected && (
            <PlanPurchaseSummary
              key={selected.id}
              locale={locale}
              destination={destination}
              plan={selected}
            />
          )}
        </div>
      </div>
      {selected && (
        <div className="pc-mobile-summary">
          <div>
            <strong>
              <Price cents={selected.retailPriceCents!} locale={locale} />
            </strong>
            <span>
              {selected.allowance} · {selected.days} {es ? "días" : "days"}
            </span>
          </div>
          <a href={"#" + id + "-summary"}>
            {es ? "Ver selección" : "View selection"}
            <ChevronRight size={16} />
          </a>
        </div>
      )}
    </section>
  );
}
