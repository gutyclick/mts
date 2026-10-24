import {
  ArrowRight,
  CreditCard,
  Globe2,
  MapPin,
  QrCode,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Tags,
  Zap,
} from "lucide-react";
import { dictionaries, pathFor, type Locale } from "@/lib/i18n";
import { DestinationGrid } from "../destination-grid";
import { ArrowLink, IconBadge, SectionHeading } from "../ui";

export function TrustStrip({ locale }: { locale: Locale }) {
  const icons = [Zap, ShieldCheck, QrCode, Tags];
  return (
    <div className="container">
      <div className="trust-strip">
        {dictionaries[locale].trust.map((item, index) => {
          const Icon = icons[index];
          return (
            <div className="trust-item" key={item.title}>
              <IconBadge icon={Icon} tone={index === 0 ? "orange" : "blue"} />
              <div>
                <h2>{item.title}</h2>
                <p>{item.body}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="preview-note">{dictionaries[locale].previewNotice}</p>
    </div>
  );
}
export function PopularDestinations({ locale }: { locale: Locale }) {
  const t = dictionaries[locale];
  return (
    <section className="section container popular-destinations">
      <SectionHeading title={t.popularTitle} description={t.popularDescription}>
        <ArrowLink href={pathFor(locale, "destinations")}>
          {t.allDestinations}
        </ArrowLink>
      </SectionHeading>
      <DestinationGrid locale={locale} />
    </section>
  );
}
export function Steps({
  locale,
  standalone = false,
}: {
  locale: Locale;
  standalone?: boolean;
}) {
  const t = dictionaries[locale];
  const icons = [MapPin, CreditCard, QrCode];
  return (
    <section
      className={`steps-section ${standalone ? "standalone-steps" : ""}`}
    >
      <div className="container">
        <div className="center-heading">
          <p className="eyebrow">{t.stepsEyebrow}</p>
          <h2>{t.stepsTitle}</h2>
          <p>{t.stepsDescription}</p>
        </div>
        <div className="steps-grid">
          {t.steps.map((step, index) => {
            const Icon = icons[index];
            return (
              <div className="step" key={step.title}>
                <div className="step-top">
                  <span className="step-icon">
                    <Icon size={27} strokeWidth={1.6} />
                    <span>{index + 1}</span>
                  </span>
                  {index < 2 && <ArrowRight className="step-arrow" size={22} />}
                </div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
export function WhyUs({ locale }: { locale: Locale }) {
  const t = dictionaries[locale];
  const icons = [SlidersHorizontal, Globe2, Smartphone, Tags];
  return (
    <section className="section container why-section">
      <div className="why-intro">
        <IconBadge icon={Sparkles} tone="orange" className="mini-mark" />
        <p className="eyebrow">{t.whyEyebrow}</p>
        <h2>{t.whyTitle}</h2>
        <p>{t.whyDescription}</p>
      </div>
      <div className="benefits-grid">
        {t.benefits.map((benefit, index) => {
          const Icon = icons[index];
          return (
            <div className="benefit" key={benefit.title}>
              <IconBadge icon={Icon} />
              <h3>{benefit.title}</h3>
              <p>{benefit.body}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
