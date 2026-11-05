"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Send,
  Info,
  ClipboardCheck,
  ArrowRight,
} from "lucide-react";
import { portalCopy, portalHref } from "@/lib/portal/copy";
import { usePortal } from "./portal-state";
import {
  PageHeading,
  PortalButton,
  TripStatus,
  type PortalProps,
} from "./portal-ui";
import type { PortalTrip } from "@/lib/portal/model";
import type { BusinessPlan } from "@/lib/portal/business";
import { businessMessage } from "./portal-business-copy";
export function PortalRequest({
  trip,
  locale,
  base,
}: PortalProps & { trip: PortalTrip }) {
  const es = locale === "es",
    t = portalCopy[locale];
  const { company, mutate } = usePortal();
  const router = useRouter();
  const [plans, setPlans] = useState<BusinessPlan[]>([]),
    [plan, setPlan] = useState(""),
    [quantity, setQuantity] = useState(trip.travelers),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [error, setError] = useState("");
  const attempt = useRef<string | null>(null);
  const tripDays =
    Math.round(
      (Date.parse(trip.returning) - Date.parse(trip.departure)) / 86400000,
    ) + 1;
  useEffect(() => {
    const controller = new AbortController();
    fetch(
      `/api/portal?company=${encodeURIComponent(company.id)}&catalog=${encodeURIComponent(trip.destinationSlug ?? "")}`,
      { cache: "no-store", signal: controller.signal },
    )
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok) throw Error(value.error ?? "unavailable");
        if (!controller.signal.aborted) {
          const options = (value.plans as BusinessPlan[]).filter(
            (value) => value.days >= tripDays,
          );
          setPlans(options);
          setPlan(options[0]?.id ?? "");
          setLoaded(true);
        }
      })
      .catch((value) => {
        if (!controller.signal.aborted) {
          setError(
            businessMessage(
              value instanceof Error ? value.message : "unavailable",
              locale,
            ),
          );
          setLoaded(true);
        }
      });
    return () => controller.abort();
  }, [company.id, trip.destinationSlug, tripDays, locale]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !plan) return;
    setBusy(true);
    setError("");
    attempt.current ??= crypto.randomUUID();
    try {
      await mutate({
        action: "request",
        companyId: company.id,
        tripId: trip.id,
        attemptId: attempt.current,
        planId: plan,
        quantity,
        version: trip.version,
      });
      router.push(portalHref(locale, base, "trip", trip.id));
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
  const selected = plans.find((value) => value.id === plan);
  return (
    <>
      <Link
        className="bp-back"
        href={portalHref(locale, base, "trip", trip.id)}
      >
        <ArrowLeft size={16} />
        {trip.name}
      </Link>
      <PageHeading
        title={t.requestTitle}
        description={
          es
            ? "Elige un plan para las fechas del viaje y envía la solicitud para revisión."
            : "Choose a plan covering the trip dates and submit it for review."
        }
      />
      {!["draft", "changes"].includes(trip.status) ? (
        <section className="bp-panel bp-empty">
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
            <label>
              {es ? "Plan del catálogo" : "Catalog plan"}
              <select
                required
                name="plan"
                value={plan}
                onChange={(event) => setPlan(event.target.value)}
                disabled={!loaded || busy}
              >
                <option value="">
                  {!loaded
                    ? es
                      ? "Cargando planes…"
                      : "Loading plans…"
                    : es
                      ? "Selecciona un plan"
                      : "Select a plan"}
                </option>
                {plans.map((value) => (
                  <option key={value.id} value={value.id}>
                    {value.name} · {value.days} {es ? "días" : "days"}
                  </option>
                ))}
              </select>
            </label>
            {loaded && !plans.length && !error && (
              <p>
                {es
                  ? "No hay planes confirmados que cubran todas las fechas. Contacta con tu canal de atención empresarial."
                  : "No confirmed plans cover the entire trip. Contact your business support channel."}
              </p>
            )}
            <label>
              {t.quantity}
              <input
                type="number"
                required
                min={1}
                max={trip.travelers}
                step={1}
                value={quantity}
                readOnly={trip.mode === "package"}
                onChange={(event) => setQuantity(Number(event.target.value))}
                inputMode="numeric"
              />
            </label>
            {trip.mode === "package" && (
              <p className="bp-note">{t.fullGroup}</p>
            )}
            <p className="bp-note">
              <Info size={17} />
              {es
                ? "La solicitud no genera un cobro. El equipo revisará disponibilidad, tarifa y condiciones antes de la emisión."
                : "Submitting does not charge you. Our team reviews availability, pricing and terms before issuance."}
            </p>
            {error && (
              <p role="alert" className="bp-error">
                {error}
              </p>
            )}
            <button
              className="bp-button"
              type="submit"
              disabled={busy || !selected}
            >
              <Send size={17} />
              {busy
                ? es
                  ? "Enviando…"
                  : "Submitting…"
                : es
                  ? "Enviar solicitud"
                  : "Submit request"}
            </button>
          </form>
          <aside className="bp-form-aside">
            <span className="bp-icon bp-icon-orange">
              <ClipboardCheck size={24} />
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
                <dt>{es ? "Fechas del viaje" : "Trip duration"}</dt>
                <dd>
                  {tripDays} {es ? "días" : "days"}
                </dd>
              </div>
              <div>
                <dt>{t.total}</dt>
                <dd>{quantity} eSIM</dd>
              </div>
              {selected && (
                <div>
                  <dt>{es ? "Plan seleccionado" : "Selected plan"}</dt>
                  <dd>{selected.name}</dd>
                </div>
              )}
            </dl>
            <p>{t.approvalNote}</p>
          </aside>
        </div>
      )}
    </>
  );
}
