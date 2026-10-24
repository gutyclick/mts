"use client";
import { useRef, useState } from "react";
import {
  Check,
  CheckCircle2,
  CreditCard,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";
import type { Destination } from "@/lib/catalog";
import type { Plan } from "@/lib/plan-utils";
import { pathFor, type Locale } from "@/lib/i18n";
import { experienceCopy } from "@/lib/experience-copy";
import { experiencePath, planPath } from "@/lib/experience-routes";
import {
  ActionLink,
  BackLink,
  ExperienceHeading,
  PassSummary,
  PreviewNotice,
} from "./shared";
export function CheckoutPreview({
  locale,
  destination,
  plan,
}: {
  locale: Locale;
  destination?: Destination;
  plan?: Plan;
}) {
  const c = experienceCopy[locale];
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState(false);
  const [understood, setUnderstood] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  function go(next: number) {
    setStep(next);
    requestAnimationFrame(() => {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView({ block: "start", behavior: "instant" });
    });
  }
  if (!destination || !plan)
    return (
      <div className="container experience-page">
        <PreviewNotice locale={locale} />
        <div className="experience-empty">
          <CreditCard size={36} />
          <h1>{c.noSelection}</h1>
          <p>{c.noSelectionBody}</p>
          <ActionLink primary href={pathFor(locale, "destinations")}>
            {c.catalog}
          </ActionLink>
        </div>
      </div>
    );
  return (
    <div className="container experience-page">
      <BackLink href={planPath(locale, destination.slug, plan.id)}>
        {c.fullDetails}
      </BackLink>
      <PreviewNotice locale={locale} />
      <ExperienceHeading
        eyebrow="MYTRIPSIM / eSIM"
        title={c.checkout}
        description={c.checkoutDescription}
      />
      <ol
        className="journey-progress"
        aria-label={
          locale === "es" ? "Pasos de la demostración" : "Preview steps"
        }
      >
        {[c.review, c.payment, c.confirmation].map((label, index) => (
          <li
            key={label}
            aria-current={step === index ? "step" : undefined}
            className={index < step ? "is-complete" : ""}
          >
            <span>{index < step ? <Check size={16} /> : index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      <div className="experience-columns">
        <section className="experience-card checkout-panel" aria-live="polite">
          <h2 tabIndex={-1} ref={heading}>
            {step === 0
              ? c.traveler
              : step === 1
                ? c.payment
                : c.confirmationTitle}
          </h2>
          {step === 0 && (
            <>
              <p className="sample-label">
                <Mail size={16} />
                {c.exampleOnly}
              </p>
              <div className="preview-fields">
                <label>
                  {c.name}
                  <input readOnly value="Alex Rivera" autoComplete="off" />
                </label>
                <label>
                  {c.email}
                  <input
                    readOnly
                    value="traveler@example.com"
                    autoComplete="off"
                  />
                </label>
              </div>
              <label className="experience-checkbox">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(event) => setChecked(event.target.checked)}
                />
                <span>{c.compatible}</span>
              </label>
              <label className="experience-checkbox">
                <input
                  type="checkbox"
                  checked={understood}
                  onChange={(event) => setUnderstood(event.target.checked)}
                />
                <span>{c.terms}</span>
              </label>
              <button className="button button-primary" onClick={() => go(1)}>
                {c.continuePayment}
              </button>
              <p className="experience-muted">
                {locale === "es"
                  ? "Puedes recorrer la muestra sin marcar estas opciones; en una compra real se validarían antes de continuar."
                  : "You can explore without checking these options; a real purchase would validate them before continuing."}
              </p>
            </>
          )}
          {step === 1 && (
            <>
              <p>{c.paymentBody}</p>
              <div className="payment-placeholder">
                <LockKeyhole size={30} />
                <strong>{c.paymentPlaceholder}</strong>
                <div className="payment-field-shapes" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="sample-label">{c.preview}</span>
              </div>
              <button className="button button-primary" onClick={() => go(2)}>
                {c.previewConfirmation}
              </button>
              <button className="experience-text-button" onClick={() => go(0)}>
                {c.back}
              </button>
            </>
          )}
          {step === 2 && (
            <>
              <span className="confirmation-stamp">
                <CheckCircle2 size={32} />
              </span>
              <p className="confirmation-copy">{c.confirmationBody}</p>
              <h3>{c.whatNext}</h3>
              <ol className="confirmation-steps">
                {c.nextSteps.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
              <ActionLink primary href={experiencePath(locale, "wallet")}>
                {c.exploreWallet}
              </ActionLink>
              <button className="experience-text-button" onClick={() => go(0)}>
                {c.review}
              </button>
            </>
          )}
        </section>
        <div className="experience-summary">
          <PassSummary locale={locale} destination={destination} plan={plan}>
            <div className="pass-assurance">
              <ShieldCheck size={19} />
              <span>{c.preview}</span>
            </div>
          </PassSummary>
        </div>
      </div>
    </div>
  );
}
