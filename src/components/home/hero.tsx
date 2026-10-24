import Image from "next/image";
import { ArrowUpRight, Check, Signal, Wifi } from "lucide-react";
import { dictionaries, type Locale } from "@/lib/i18n";
import { DestinationSearch } from "../destination-search";

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
          <span className="hero-accent">
            {t.heroAccent}
            <svg
              viewBox="0 0 320 14"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M3 10Q145-3 315 6"
                stroke="currentColor"
                strokeWidth="5"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </span>{" "}
          {t.heroEnd}
        </h1>
        <p className="hero-description">{t.heroDescription}</p>
        <DestinationSearch locale={locale} />
        <p className="hero-footnote">
          <Check size={15} />
          {t.heroNote}
        </p>
      </div>
      <div className="hero-visual" aria-label={t.visualTag}>
        <div className="visual-orbit orbit-one" />
        <div className="visual-orbit orbit-two" />
        <div className="visual-dot dot-one" />
        <div className="visual-dot dot-two" />
        <svg
          className="flight-path"
          viewBox="0 0 460 420"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M40 280C-10 130 140 10 310 50c160 40 135 260 30 260-115 0-190-105-90-140"
            stroke="#C1D9ED"
            strokeWidth="1.6"
            strokeDasharray="5 7"
          />
        </svg>
        <span className="floating-icon wifi-float">
          <Wifi size={27} />
        </span>
        <span className="floating-icon plane-float">
          <ArrowUpRight size={28} />
        </span>
        <div className="mascot-stage">
          <Image
            className="hero-mascot"
            src="/images/traveler-cat.svg"
            alt=""
            width={440}
            height={440}
            priority
          />
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
