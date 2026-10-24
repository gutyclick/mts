import { Check, Plane, Signal, Wifi } from "lucide-react";
import { dictionaries, type Locale } from "@/lib/i18n";
import { DestinationSearch } from "../destination-search";
import { MascotIllustration } from "../illustrations";

export function Hero({ locale }: { locale: Locale }) {
  const t = dictionaries[locale];
  return (
    <section className="hero container">
      <div className="hero-copy">
        <p className="eyebrow hero-eyebrow">
          <span />
          {t.eyebrow}
        </p>
        <h1>
          {t.heroStart}
          <br />
          <span className="hero-accent">{t.heroAccent}</span> {t.heroEnd}
        </h1>
        <p className="hero-description">{t.heroDescription}</p>
        <DestinationSearch locale={locale} />
        <p className="hero-footnote">
          <Check size={15} />
          {t.heroNote}
        </p>
      </div>
      <div className="hero-visual" aria-label={t.visualTag}>
        <div className="travel-backdrop" aria-hidden="true">
          <span className="travel-cloud cloud-one" />
          <span className="travel-cloud cloud-two" />
          <span className="travel-sun" />
          <span className="travel-horizon" />
        </div>
        <svg
          className="flight-path"
          viewBox="0 0 460 420"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M48 180C40 65 230 5 355 90c76 53 53 154-30 162"
            stroke="#C3DAEF"
            strokeWidth="2"
            strokeDasharray="5 8"
          />
        </svg>
        <span className="floating-icon wifi-float">
          <Wifi size={26} strokeWidth={2.2} />
        </span>
        <span className="floating-icon plane-float">
          <Plane size={25} strokeWidth={1.8} />
        </span>
        <div className="mascot-stage">
          <MascotIllustration className="hero-mascot" />
        </div>
        <div className="connection-card">
          <span className="connection-check">
            <Check size={17} />
          </span>
          <div>
            <strong>{t.visualStatus}</strong>
            <span>MyTripSim eSIM</span>
          </div>
          <Signal size={21} />
        </div>
        <p className="visual-caption">{t.visualLabel}</p>
      </div>
    </section>
  );
}
