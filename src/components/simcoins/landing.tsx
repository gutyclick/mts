"use client";
import { useEffect, useState } from "react";
import {
  observeSimcoinsLanding,
  recordSimcoinsStats,
} from "@/lib/simcoins/analytics-client";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Coins, Compass, Plane } from "lucide-react";
import { pathFor, type Locale } from "@/lib/i18n";
import { authPath } from "@/lib/auth-routes";
import type { SimcoinsPublicProgram } from "@/lib/simcoins/model";
import { LevelBadge } from "./art";
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
  const [conditionsOpen, setConditionsOpen] = useState(false);
  useEffect(observeSimcoinsLanding, []);
  const releaseDays = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
  }).format(program.releaseDelaySeconds / 86400);
  const icons = [Compass, Coins, Plane];
  return (
    <div className="simcoins-page">
      <section className="sc-hero container">
        <div className="sc-hero-copy">
          <nav
            className="sc-breadcrumb"
            aria-label={locale === "es" ? "Ruta de navegación" : "Breadcrumb"}
          >
            <Link href={pathFor(locale)}>
              {locale === "es" ? "Inicio" : "Home"}
            </Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">SimCoins</span>
          </nav>
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
            <a className="sc-text-link" href="#sc-levels">
              {locale === "es" ? "Descubre los niveles" : "Explore the levels"}
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
            <LevelBadge id="traveler" size={64} />
            <div>
              <strong>
                {locale === "es"
                  ? "Tu aventura empieza en Viajero"
                  : "Your journey starts as a Traveler"}
              </strong>
              <p>
                {locale === "es"
                  ? "0% al registrarte. La primera compra elegible desbloquea tu siguiente nivel."
                  : "0% when you join. Your first eligible purchase unlocks your next level."}
              </p>
            </div>
            {currentLevelId === "traveler" && (
              <span className="sc-current-level">
                {locale === "es" ? "Tu nivel" : "Your level"}
              </span>
            )}
          </div>
          <div className="sc-levels">
            {program.levels
              .filter((level) => level.rateBps > 0)
              .map((level, i) => (
                <article
                  className={`sc-level sc-level-${i}`}
                  key={level.id}
                  data-current={currentLevelId === level.id || undefined}
                >
                  <LevelBadge id={level.id} size={112} />
                  <h3>{level.name}</h3>
                  {currentLevelId === level.id && (
                    <span className="sc-current-level">
                      {locale === "es"
                        ? "Tu nivel actual"
                        : "Your current level"}
                    </span>
                  )}
                  <strong>
                    {level.rateBps / 100}
                    <small>%</small>
                  </strong>
                  <p className="sc-level-reward">{t.reward}</p>
                  <div>
                    {level.id === "explorer"
                      ? t.first
                      : `${t.from} USD ${level.thresholdCents / 100}`}
                  </div>
                </article>
              ))}
          </div>
        </section>
        <section className="sc-section sc-usage" aria-labelledby="sc-usage">
          <div className="sc-usage-art">
            <Image
              src="/images/simcoins/simcoins_pile.webp"
              alt=""
              width={360}
              height={360}
              sizes="(max-width: 700px) 180px, 240px"
            />
          </div>
          <div>
            <span className="sc-value-pill">100 SimCoins = USD 1</span>
            <h2 id="sc-usage">{t.use}</h2>
            <p className="sc-lead">{t.useIntro}</p>
            <ul className="sc-usage-facts">
              <li>
                {locale === "es"
                  ? `Hasta ${program.maxRedeemBps / 100}% de ahorro por compra`
                  : `Up to ${program.maxRedeemBps / 100}% off per purchase`}
              </li>
              <li>
                {locale === "es"
                  ? "Sin vencimiento ordinario"
                  : "No ordinary expiry"}
              </li>
            </ul>
            <a
              className="sc-text-link"
              href="#sc-conditions"
              onClick={() => setConditionsOpen(true)}
            >
              {locale === "es"
                ? "Cómo usar tus monedas"
                : "How to use your coins"}
              <ArrowRight size={16} />
            </a>
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
          <details
            id="sc-conditions"
            open={conditionsOpen}
            onToggle={(event) => setConditionsOpen(event.currentTarget.open)}
          >
            <summary>
              {locale === "es"
                ? "Condiciones de tus SimCoins"
                : "Your SimCoins conditions"}
            </summary>
            <p>
              {locale === "es"
                ? `100 SimCoins equivalen a USD 1 de crédito promocional. Se liberan ${releaseDays} días después de la entrega verificada de tu eSIM y su correo. El pago y la entrega deben estar confirmados. El canje se limita al saldo disponible y a un máximo del ${program.maxRedeemBps / 100}% del importe elegible, sin combinación automática con otras promociones. No se pueden transferir ni retirar como efectivo. Las devoluciones ajustan las monedas y el progreso del pedido original. La elegibilidad y recompensa se muestran antes de pagar.`
                : `100 SimCoins equal USD 1 in promotional credit. They become available ${releaseDays} days after verified eSIM and email delivery. Payment and delivery must be confirmed. Redemption is limited to your available balance and up to ${program.maxRedeemBps / 100}% of the eligible amount, without automatic stacking with other promotions. Coins cannot be transferred or withdrawn as cash. Refunds adjust coins and progress from the original order. Eligibility and rewards are shown before payment.`}
            </p>
            <Link className="sc-text-link" href={pathFor(locale, "terms")}>
              {locale === "es" ? "Términos del servicio" : "Terms of service"}
              <ArrowRight size={16} />
            </Link>
          </details>
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
