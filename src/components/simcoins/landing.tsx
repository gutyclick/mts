"use client";
import { useEffect } from "react";
import {
  observeSimcoinsLanding,
  recordSimcoinsStats,
} from "@/lib/simcoins/analytics-client";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Coins,
  Compass,
  Plane,
  ShieldCheck,
} from "lucide-react";
import { pathFor, type Locale } from "@/lib/i18n";
import { authPath } from "@/lib/auth-routes";
import type { SimcoinsPublicProgram } from "@/lib/simcoins/model";
import { SimcoinsCalculator } from "./calculator";
import { simcoinsCopy } from "./copy";

export function SimcoinsLanding({
  locale,
  program,
  authenticated = false,
  currentLevelId,
}: {
  locale: Locale;
  program: SimcoinsPublicProgram;
  authenticated?: boolean;
  currentLevelId?: string;
}) {
  const t = simcoinsCopy[locale];
  useEffect(observeSimcoinsLanding, []);
  const releaseDays = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(program.releaseDelaySeconds / 86400);
  const icons = [Compass, Coins, Plane];
  return (
    <div className="simcoins-page">
      <section className="sc-hero container">
        <div className="sc-hero-copy">
          <p className="sc-eyebrow">{t.eyebrow}</p>
          <h1>{t.title}</h1>
          <p className="sc-lead">{t.intro}</p>
          {!program.enabled && (
            <div className="sc-launch-note">
              <span>{t.preview}</span>
              <p>{t.off}</p>
            </div>
          )}
          <div className="sc-actions">
            <Link
              className="button button-primary"
              href={
                authenticated
                  ? `/${locale}/account/simcoins`
                  : `${authPath(locale, "register")}?next=${encodeURIComponent(`/${locale}/account/simcoins`)}`
              }
              data-simcoins-event={authenticated ? "wallet_open" : "join_click"}
              onClick={() => {
                if (!authenticated) recordSimcoinsStats("simcoins_join");
              }}
            >
              {authenticated
                ? t.wallet
                : locale === "es"
                  ? "Únete gratis"
                  : "Join for free"}
              <ArrowRight size={18} />
            </Link>
            <a className="sc-text-link" href="#calculator">
              {locale === "es" ? "Calcula un ejemplo" : "Calculate an example"}
              <ArrowRight size={17} />
            </a>
          </div>
        </div>
        <div className="sc-hero-art">
          <Image
            src="/images/sim/sim_coin_pile.webp"
            alt={
              locale === "es"
                ? "SIM celebra entre monedas doradas con huellas de gato"
                : "SIM celebrating among golden paw-print coins"
            }
            width={1000}
            height={923}
            sizes="(max-width: 700px) 90vw, 48vw"
            loading="eager"
            fetchPriority="high"
          />
          <div className="sc-coin-caption">
            <Coins size={19} />
            <span>100 SimCoins = USD 1</span>
          </div>
        </div>
      </section>
      <div className="container">
        <section className="sc-section" aria-labelledby="sc-how">
          <div className="sc-section-heading">
            <p className="sc-eyebrow">
              {locale === "es" ? "CÓMO FUNCIONA" : "HOW IT WORKS"}
            </p>
            <h2 id="sc-how">{t.how}</h2>
          </div>
          <div className="sc-steps">
            {t.steps.map(([title, body], i) => {
              const Icon = icons[i];
              return (
                <article key={title}>
                  <div className="sc-step-icon">
                    <Icon size={25} />
                    <span>{i + 1}</span>
                  </div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section
          className="sc-section sc-level-section"
          aria-labelledby="sc-levels"
        >
          <div className="sc-section-heading">
            <p className="sc-eyebrow">
              {locale === "es" ? "TU RECORRIDO" : "YOUR JOURNEY"}
            </p>
            <h2 id="sc-levels">{t.levels}</h2>
            <p>{t.levelsIntro}</p>
          </div>
          <div className="sc-welcome">
            <strong>
              {locale === "es" ? "Viajero · 0%" : "Traveler · 0%"}
            </strong>{" "}
            —{" "}
            {locale === "es"
              ? "Empiezas aquí. Tu primera compra elegible te lleva a Explorer; las compras siguientes usan tu nuevo nivel."
              : "Start here. Your first eligible purchase takes you to Explorer; later purchases use your new level."}
            {currentLevelId === "traveler" && (
              <p>
                <strong>
                  {locale === "es" ? "Tu nivel actual" : "Your current level"}
                </strong>
              </p>
            )}
          </div>
          <div className="sc-levels">
            {program.levels
              .filter((level) => level.rateBps > 0)
              .map((level, i) => (
                <article
                  className={`sc-level sc-level-${i}`}
                  key={level.id}
                  style={
                    currentLevelId === level.id
                      ? { outline: "2px solid var(--blue)", outlineOffset: 3 }
                      : undefined
                  }
                >
                  <span className="sc-level-mark">
                    <Compass size={23} />
                  </span>
                  <h3>{level.name}</h3>
                  {currentLevelId === level.id && (
                    <p>
                      <strong style={{ fontSize: 12, letterSpacing: 0 }}>
                        {locale === "es"
                          ? "Tu nivel actual"
                          : "Your current level"}
                      </strong>
                    </p>
                  )}
                  <strong>
                    {level.rateBps / 100}
                    <small>%</small>
                  </strong>
                  <p>{t.reward}</p>
                  <div>
                    {level.id === "explorer"
                      ? t.first
                      : `${t.from} USD ${level.thresholdCents / 100} ${t.spend}`}
                  </div>
                </article>
              ))}
          </div>
        </section>
        <SimcoinsCalculator locale={locale} program={program} />
        <section className="sc-section sc-usage" aria-labelledby="sc-usage">
          <div className="sc-usage-art">
            <Image
              src="/images/simcoins/simcoins_one.webp"
              alt=""
              width={360}
              height={360}
              sizes="(max-width: 700px) 150px, 220px"
            />
          </div>
          <div>
            <p className="sc-eyebrow">100 SIMCOINS = USD 1</p>
            <h2 id="sc-usage">{t.use}</h2>
            <p className="sc-lead">{t.useIntro}</p>
            <p>
              {locale === "es"
                ? `La espera configurada es de ${releaseDays} días después de la entrega verificada: eSIM preparada y confirmación de entrega del correo. La aceptación del envío por sí sola no inicia este período.`
                : `The configured waiting period is ${releaseDays} days after verified delivery: a prepared eSIM and confirmed email delivery. Email sending acceptance alone does not start this period.`}
            </p>
            <ul>
              {t.rules.map((rule) => (
                <li key={rule}>
                  <Check size={18} />
                  {rule}
                </li>
              ))}
            </ul>
            <p className="sc-small">
              <ShieldCheck size={16} />
              {locale === "es"
                ? `El canje podrá cubrir hasta ${program.maxRedeemBps / 100}% del importe elegible, sujeto a las condiciones de la compra.`
                : `Redemption may cover up to ${program.maxRedeemBps / 100}% of the eligible amount, subject to purchase conditions.`}
            </p>
            <Link className="sc-text-link" href={pathFor(locale, "terms")}>
              {locale === "es"
                ? "Consulta los términos del programa"
                : "Read the program terms"}
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
        <section className="sc-section sc-faq" aria-labelledby="sc-faq">
          <div className="sc-section-heading">
            <h2 id="sc-faq">{t.faq}</h2>
          </div>
          {t.questions.map(([question, answer], index) => (
            <details key={question}>
              <summary>{question}</summary>
              <p>
                {index === 1 && program.enabled
                  ? locale === "es"
                    ? "Consulta tu checkout para ver si la compra admite SimCoins y las recompensas que le corresponden. Solo las operaciones elegibles confirmadas generan progreso y monedas según tu nivel anterior a la compra."
                    : "Check your checkout for purchase eligibility and its applicable rewards. Only confirmed eligible purchases generate progress and coins, using your level before the purchase."
                  : answer}
              </p>
            </details>
          ))}
        </section>
        <section className="sc-final">
          <div>
            <h2>{t.cta}</h2>
            <p>{t.ctaText}</p>
          </div>
          <Link
            href={pathFor(locale, "destinations")}
            className="button button-primary"
          >
            {t.explore}
            <ArrowRight size={18} />
          </Link>
        </section>
      </div>
    </div>
  );
}
