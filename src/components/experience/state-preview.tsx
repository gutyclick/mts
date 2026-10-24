"use client";
import { CloudOff, Luggage } from "lucide-react";
import { experienceCopy } from "@/lib/experience-copy";
import { pathFor, type Locale } from "@/lib/i18n";
import { ActionLink } from "./shared";
export type PreviewState = "normal" | "empty" | "loading" | "error";
export function StateControls({
  locale,
  value,
  onChange,
}: {
  locale: Locale;
  value: PreviewState;
  onChange: (value: PreviewState) => void;
}) {
  const c = experienceCopy[locale];
  return (
    <details className="preview-controls">
      <summary>{c.designTools}</summary>
      <label>
        {c.stateLabel}
        <select
          value={value}
          onChange={(event) => onChange(event.target.value as PreviewState)}
        >
          {(["normal", "empty", "loading", "error"] as const).map((key) => (
            <option key={key} value={key}>
              {c[key]}
            </option>
          ))}
        </select>
      </label>
    </details>
  );
}
export function StateView({
  locale,
  state,
  onReset,
}: {
  locale: Locale;
  state: PreviewState;
  onReset: () => void;
}) {
  const c = experienceCopy[locale];
  if (state === "loading")
    return (
      <div
        className="experience-loading"
        role="status"
        aria-label={c.loadingLabel}
      >
        <span className="sr-only">{c.loadingLabel}</span>
        {[1, 2, 3].map((id) => (
          <div className="pass-skeleton" key={id} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    );
  return (
    <div className="experience-empty">
      {state === "error" ? <CloudOff size={36} /> : <Luggage size={36} />}
      <h2>{state === "error" ? c.errorTitle : c.noTrips}</h2>
      <p>{state === "error" ? c.errorBody : c.noTripsBody}</p>
      {state === "error" ? (
        <button className="button button-primary" onClick={onReset}>
          {c.retry}
        </button>
      ) : (
        <ActionLink primary href={pathFor(locale, "destinations")}>
          {c.catalog}
        </ActionLink>
      )}
    </div>
  );
}
