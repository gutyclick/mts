import { Check } from "lucide-react";
import { dictionaries, type Locale } from "@/lib/i18n";
import { DestinationSearch } from "../destination-search";
import { SimMascot } from "../sim-mascot";
import { getDestinations, getPopularDestinations } from "@/lib/catalog-server";

export async function Hero({ locale }: { locale: Locale }) {
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
        <DestinationSearch
          locale={locale}
          items={await getDestinations()}
          popular={await getPopularDestinations()}
        />
        <p className="hero-footnote">
          <Check size={15} />
          {t.heroNote}
        </p>
      </div>
      <div className="sim-hero-visual">
        <SimMascot
          variant="traveler"
          locale={locale}
          className="sim-hero-mascot"
          sizes="(max-width: 360px) 110px, (max-width: 650px) 132px, 440px"
          eager
        />
        <div className="sim-hero-status">
          <Check size={20} aria-hidden="true" />
          <div>
            <strong>{t.visualStatus}</strong>
            <span>MyTripSim eSIM</span>
          </div>
        </div>
        <p className="sim-hero-caption">{t.visualLabel}</p>
      </div>
    </section>
  );
}
