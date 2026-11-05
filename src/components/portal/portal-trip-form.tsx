"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Luggage,
  Package,
  Ticket,
} from "lucide-react";
import { portalCopy, portalHref } from "@/lib/portal/copy";
import { type TripMode } from "@/lib/portal/model";
import { destinations } from "@/lib/catalog";
import { businessMessage } from "./portal-business-copy";
import { usePortal } from "./portal-state";
import { PageHeading, type PortalProps } from "./portal-ui";

export function PortalTripForm({ locale, base }: PortalProps) {
  const t = portalCopy[locale];
  const router = useRouter();
  const { mutate, company } = usePortal();
  const [mode, setMode] = useState<TripMode>("package");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const attempt = useRef<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    attempt.current ??= crypto.randomUUID();
    try {
      const id = await mutate({
        action: "create_trip",
        companyId: company.id,
        id: attempt.current,
        name: String(data.get("name") ?? ""),
        destination: String(data.get("destination") ?? ""),
        departure: String(data.get("departure") ?? ""),
        returning: String(data.get("returning") ?? ""),
        travelers: Number(data.get("travelers")),
        mode,
      });
      if (!id) throw Error("unavailable");
      router.push(portalHref(locale, base, "trip", id));
      router.refresh();
    } catch (value) {
      setError(
        businessMessage(
          value instanceof Error ? value.message : "unavailable",
          locale,
        ),
      );
      setBusy(false);
    }
  }
  return (
    <>
      <Link className="bp-back" href={portalHref(locale, base, "trips")}>
        <ArrowLeft size={16} />
        {t.back}
      </Link>
      <PageHeading
        title={t.new}
        description={
          locale === "es"
            ? "Un nombre, unas fechas y un grupo. Empecemos por ahí."
            : "A name, some dates and a group. Start here."
        }
      />
      <div className="bp-form-grid">
        <form className="bp-panel bp-form" onSubmit={submit}>
          <label>
            {t.tripName}
            <input
              name="name"
              required
              maxLength={90}
              placeholder={t.namePlaceholder}
              autoComplete="off"
            />
          </label>
          <label>
            {t.destination}
            <select name="destination" required defaultValue="">
              <option value="" disabled>
                {locale === "es"
                  ? "Selecciona un destino"
                  : "Select a destination"}
              </option>
              {[...destinations]
                .sort((a, b) =>
                  a.name[locale].localeCompare(b.name[locale], locale),
                )
                .map((value) => (
                  <option key={value.slug} value={value.slug}>
                    {value.name[locale]}
                  </option>
                ))}
            </select>
          </label>
          <div className="bp-form-row">
            <label>
              {t.departure}
              <input type="date" name="departure" required />
            </label>
            <label>
              {t.returning}
              <input type="date" name="returning" required />
            </label>
          </div>
          <label>
            {t.groupSize}
            <input
              type="number"
              name="travelers"
              min={1}
              max={10000}
              step={1}
              defaultValue={30}
              required
              inputMode="numeric"
            />
          </label>
          <fieldset>
            <legend>{t.modality}</legend>
            <div className="bp-mode-options">
              {[
                { value: "package", icon: Package, info: t.packageInfo },
                { value: "individual", icon: Ticket, info: t.individualInfo },
              ].map(({ value, icon: Icon, info }) => (
                <label
                  key={value}
                  className={`bp-mode${mode === value ? " bp-mode-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={value}
                    checked={mode === value}
                    onChange={() => setMode(value as TripMode)}
                  />
                  <Icon size={23} />
                  <span>
                    <strong>{t[value as TripMode]}</strong>
                    <small>{info}</small>
                  </span>
                  <span className="bp-radio" aria-hidden="true">
                    {mode === value && <Check size={12} />}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && (
            <p role="alert" className="bp-error">
              {error}
            </p>
          )}
          <button className="bp-button" type="submit" disabled={busy}>
            {busy ? (locale === "es" ? "Guardando…" : "Saving…") : t.create}
            <ArrowRight size={18} />
          </button>
        </form>
        <aside className="bp-form-aside">
          <span className="bp-icon bp-icon-orange">
            <Luggage size={25} />
          </span>
          <h2>{t.nextSteps}</h2>
          <ol className="bp-steps">
            {[t.step1, t.step2, t.step3].map((step, index) => (
              <li key={step}>
                <span>{index + 1}</span>
                {step}
              </li>
            ))}
          </ol>
          <p>{t.approvalNote}</p>
        </aside>
      </div>
    </>
  );
}
