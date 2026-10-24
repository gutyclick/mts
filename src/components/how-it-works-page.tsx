import Link from "next/link";
import {
  ArrowRight,
  Check,
  CircleHelp,
  MapPin,
  QrCode,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
} from "lucide-react";
import { dictionaries, pathFor, type Locale } from "@/lib/i18n";
import { experiencePath } from "@/lib/experience-routes";
import { catalogCopy } from "@/lib/catalog-copy";
import { SimMascot } from "./sim-mascot";

export function HowItWorksPage({ locale }: { locale: Locale }) {
  const t = dictionaries[locale];
  const es = locale === "es";
  const icons = [MapPin, SlidersHorizontal, QrCode];
  return (
    <div className="container how-page">
      <header className="how-heading">
        <SimMascot
          variant="adventurer"
          locale={locale}
          className="how-sim-mascot"
          sizes="(max-width: 650px) 144px, 208px"
          eager
        />
        <p className="eyebrow">MYTRIPSIM / {t.nav.how}</p>
        <h1>{t.howTitle}</h1>
        <p>{t.howDescription}</p>
      </header>

      <section className="how-process" aria-labelledby="how-process-title">
        <div className="how-section-heading">
          <p className="eyebrow">{t.stepsEyebrow}</p>
          <h2 id="how-process-title">{t.stepsTitle}</h2>
          <p>{t.stepsDescription}</p>
        </div>
        <ol className="how-step-list">
          {t.steps.map((step, index) => {
            const Icon = icons[index];
            return (
              <li key={step.title}>
                <div className="how-step-marker">
                  <Icon size={27} strokeWidth={1.7} aria-hidden="true" />
                  <span aria-hidden="true">{index + 1}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
                {index < 2 && (
                  <ArrowRight
                    className="how-step-connector"
                    size={20}
                    aria-hidden="true"
                  />
                )}
              </li>
            );
          })}
        </ol>
      </section>

      <section
        className="how-preparation"
        aria-labelledby="how-preparation-title"
      >
        <div className="how-preparation-grid">
          <div className="how-preparation-intro">
            <span className="how-preparation-icon">
              <ShieldCheck size={26} aria-hidden="true" />
            </span>
            <h2 id="how-preparation-title">{t.howChecklist}</h2>
            <p>
              {es
                ? "Revisa estos detalles antes de instalar tu eSIM y guarda las instrucciones para tu viaje."
                : "Check these details before installing your eSIM and keep the instructions for your trip."}
            </p>
            <div className="how-guide-links">
              <Link href={pathFor(locale, "compatibility")}>
                <Smartphone size={17} aria-hidden="true" />
                {es ? "Verificar compatibilidad" : "Check compatibility"}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
              <Link href={experiencePath(locale, "install")}>
                <QrCode size={17} aria-hidden="true" />
                {es ? "Guía de instalación" : "Installation guide"}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </div>
          <ul className="how-checklist">
            {t.howItems.map((item) => (
              <li key={item}>
                <span>
                  <Check size={17} aria-hidden="true" />
                </span>
                <p>{item}</p>
              </li>
            ))}
          </ul>
        </div>
        <footer className="how-actions">
          <Link
            href={pathFor(locale, "destinations")}
            className="button button-primary"
          >
            {t.find}
            <ArrowRight size={17} aria-hidden="true" />
          </Link>
          <Link
            href={pathFor(locale, "faq")}
            className="button button-secondary"
          >
            <CircleHelp size={18} aria-hidden="true" />
            {catalogCopy[locale].faq}
          </Link>
        </footer>
      </section>
    </div>
  );
}
