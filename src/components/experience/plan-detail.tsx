import Link from "next/link";
import { ArrowRight, Check, Globe2, Smartphone, Wifi } from "lucide-react";
import { pathFor, type Locale } from "@/lib/i18n";
import { experiencePath } from "@/lib/experience-routes";
import { experienceCopy } from "@/lib/experience-copy";
import type { Destination } from "@/lib/catalog";
import type { Plan } from "@/lib/plan-utils";
import { ActionLink, BackLink, PassSummary } from "./shared";
export function PlanDetail({
  locale,
  destination,
  plan,
}: {
  locale: Locale;
  destination: Destination;
  plan: Plan;
}) {
  const c = experienceCopy[locale];
  return (
    <div className="container experience-page">
      <BackLink href={pathFor(locale, undefined, destination.slug)}>
        {destination.name[locale]} · {c.allPlans}
      </BackLink>
      <header className="experience-heading">
        <p className="eyebrow">{destination.name[locale]} / eSIM</p>
        <h1>{plan.name}</h1>
        <p>{c.coverageBody}</p>
      </header>
      <div className="experience-columns">
        <div>
          <div className="plan-feature-pills">
            <span>
              <Wifi size={16} />
              {c[plan.kind]}
            </span>
            <span>
              <Check size={16} />
              eSIM
            </span>
          </div>
          <section className="experience-card">
            <div className="card-title">
              <Globe2 size={23} />
              <h2>{c.coverage}</h2>
            </div>
            <div className="coverage-destination">
              <span>{destination.name[locale]}</span>
              <small>
                {destination.type === "region"
                  ? c.regionalCoverage
                  : c.countryCoverage}
              </small>
            </div>
            <dl className="experience-facts">
              <div>
                <dt>{c.networks}</dt>
                <dd>{c.pending}</dd>
              </div>
              <div>
                <dt>{c.activation}</dt>
                <dd>{c.pending}</dd>
              </div>
            </dl>
          </section>
          <section className="experience-card">
            <h2>{c.conditions}</h2>
            <p>{c.conditionsBody}</p>
            <details className="experience-accordion">
              <summary>
                {c.hotspot}
                <ArrowRight size={17} />
              </summary>
              <p>{c.hotspotBody}</p>
              <Link href={`${pathFor(locale, "faq")}#faq-hotspot`}>
                {c.faq}
              </Link>
            </details>
            <details className="experience-accordion">
              <summary>
                {c.calls}
                <ArrowRight size={17} />
              </summary>
              <p>{c.callsBody}</p>
              <Link href={`${pathFor(locale, "faq")}#faq-phone-number-sms`}>
                {c.faq}
              </Link>
            </details>
            <details className="experience-accordion">
              <summary>
                {c.activation}
                <ArrowRight size={17} />
              </summary>
              <p>{c.conditionsBody}</p>
              <Link href={`${pathFor(locale, "faq")}#faq-activation-start`}>
                {c.faq}
              </Link>
            </details>
          </section>
          <section className="experience-card setup-card">
            <Smartphone size={28} />
            <div>
              <h2>{c.installation}</h2>
              <p>{c.installationBody}</p>
              <ActionLink href={pathFor(locale, "compatibility")}>
                {c.compatibility}
              </ActionLink>
            </div>
          </section>
        </div>
        <div className="experience-summary">
          <PassSummary locale={locale} destination={destination} plan={plan}>
            <ActionLink
              primary
              href={experiencePath(locale, "checkout", {
                destination: destination.slug,
                plan: plan.id,
              })}
            >
              {c.previewPurchase}
            </ActionLink>
            <p className="pass-footnote">{c.previewBody}</p>
          </PassSummary>
        </div>
      </div>
    </div>
  );
}
