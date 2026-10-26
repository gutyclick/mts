import { Check } from "lucide-react";
import { dictionaries, type Locale } from "@/lib/i18n";
import { DestinationSearch } from "../destination-search";
import { SimMascot } from "../sim-mascot";
import { getDestinations, getPopularDestinations } from "@/lib/catalog-server";

export async function Hero({ locale }: { locale: Locale }) {
  const t = dictionaries[locale];
  const es = locale === "es";
  const destinations = await getDestinations();
  return (
    <section className="hero container">
      <div className="hero-copy">
        <p className="eyebrow hero-eyebrow">
          <span />
          {t.eyebrow}
        </p>
        <h1>
          {es ? "Tu eSIM de viaje," : "Travel eSIMs,"}
          <br />
          <span className="hero-accent">
            {es ? "un mundo" : "wherever"}
          </span>{" "}
          {es ? "por descubrir." : "you go."}
        </h1>
        <p className="hero-description">
          {es
            ? `Compara planes de datos para ${destinations.length} destinos. Elige los GB y días de tu viaje y comprueba la cobertura y compatibilidad de tu teléfono.`
            : `Compare travel data plans for ${destinations.length} destinations. Choose your data and days, then check coverage and your phone’s compatibility.`}
        </p>
        <DestinationSearch
          locale={locale}
          items={destinations}
          popular={await getPopularDestinations()}
        />
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
