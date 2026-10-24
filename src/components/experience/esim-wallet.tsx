"use client";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, CalendarDays, Globe2, LifeBuoy, Wifi } from "lucide-react";
import { destinations } from "@/lib/catalog";
import { demoEsims, type DemoEsim } from "@/lib/demo-esims";
import { experienceCopy } from "@/lib/experience-copy";
import { experiencePath } from "@/lib/experience-routes";
import { pathFor, type Locale } from "@/lib/i18n";
import { DestinationFlag } from "../destination-flag";
import { DestinationArtwork } from "../illustrations";
import {
  ActionLink,
  BackLink,
  ExperienceHeading,
  PreviewNotice,
} from "./shared";
import { SampleCode } from "./sample-code";
import { StateControls, StateView, type PreviewState } from "./state-preview";
export function EsimWallet({
  locale,
  selected,
}: {
  locale: Locale;
  selected?: DemoEsim;
}) {
  const c = experienceCopy[locale];
  const [status, setStatus] = useState("all");
  const [state, setState] = useState<PreviewState>("normal");
  if (selected) {
    const destination = destinations.find(
      (d) => d.slug === selected.destination,
    )!;
    return (
      <div className="container experience-page">
        <BackLink href={experiencePath(locale, "wallet")}>{c.wallet}</BackLink>
        <PreviewNotice locale={locale} />
        <ExperienceHeading
          eyebrow={c.example}
          title={`${destination.name[locale]} eSIM`}
          description={c[`${selected.status}Body`]}
        />
        <div className="experience-columns">
          <div>
            <section className="experience-card">
              <div className="card-title">
                <Wifi size={23} />
                <h2>{c.usage}</h2>
                <span className={`esim-status is-${selected.status}`}>
                  {c[selected.status]}
                </span>
              </div>
              <div className="usage-value">
                <strong>
                  {selected.allowance - selected.used} <small>GB</small>
                </strong>
                <span>{c.remaining}</span>
              </div>
              <meter
                min={0}
                max={selected.allowance}
                value={selected.used}
                aria-label={`${c.usage}: ${selected.used} / ${selected.allowance} GB`}
              />
              <p className="experience-muted">
                {selected.used} / {selected.allowance} GB · {c.exampleUsage}
              </p>
              <dl className="experience-facts">
                <div>
                  <dt>{c.validity}</dt>
                  <dd>
                    {selected.days} {c.days}
                    <small>
                      {selected.dates} · {c.exampleValidity}
                    </small>
                  </dd>
                </div>
                <div>
                  <dt>{c.installationStatus}</dt>
                  <dd>{c[selected.status]}</dd>
                </div>
              </dl>
            </section>
            <section className="experience-card">
              <h2>{c.manual}</h2>
              <p>{c.manualBody}</p>
              <div className="manual-placeholder">
                <span>SM-DP+</span>
                <strong>—</strong>
                <span>
                  {locale === "es" ? "Código de activación" : "Activation code"}
                </span>
                <strong>—</strong>
              </div>
            </section>
            <section className="experience-card">
              <h2>{c.topUp}</h2>
              <p>{c.topUpBody}</p>
              <ActionLink href={pathFor(locale, undefined, destination.slug)}>
                {c.allPlans}
              </ActionLink>
            </section>
          </div>
          <div className="experience-summary">
            <section className="experience-card code-card">
              <DestinationFlag destination={destination} />
              <h2>{c.sampleCode}</h2>
              <SampleCode />
              <p>{c.sampleCodeBody}</p>
              <ActionLink
                primary
                href={experiencePath(locale, "install", { esim: selected.id })}
              >
                {c.installGuide}
              </ActionLink>
            </section>
            <section className="experience-card help-mini">
              <LifeBuoy size={24} />
              <h2>{c.help}</h2>
              <p>{c.helpBody}</p>
              <ActionLink href={pathFor(locale, "faq")}>{c.faq}</ActionLink>
            </section>
          </div>
        </div>
      </div>
    );
  }
  const records = demoEsims.filter(
    (record) => status === "all" || record.status === status,
  );
  return (
    <div className="container experience-page">
      <PreviewNotice locale={locale} />
      <ExperienceHeading
        eyebrow={c.wallet}
        title={c.walletTitle}
        description={c.walletDescription}
      />
      <StateControls locale={locale} value={state} onChange={setState} />
      {state !== "normal" ? (
        <StateView
          locale={locale}
          state={state}
          onReset={() => setState("normal")}
        />
      ) : (
        <>
          <div className="catalog-tabs" role="group" aria-label={c.status}>
            {(["all", "ready", "active", "ended"] as const).map((key) => (
              <button
                key={key}
                aria-pressed={status === key}
                onClick={() => setStatus(key)}
              >
                {c[key]}
                <span aria-hidden="true">
                  {key === "all"
                    ? demoEsims.length
                    : demoEsims.filter((record) => record.status === key)
                        .length}
                </span>
              </button>
            ))}
          </div>
          <div className="wallet-grid">
            {records.map((record) => {
              const destination = destinations.find(
                (d) => d.slug === record.destination,
              )!;
              return (
                <article className="esim-pass" key={record.id}>
                  <div className="esim-pass-art">
                    <DestinationArtwork
                      destination={destination}
                      locale={locale}
                    />
                    <span className={`esim-status is-${record.status}`}>
                      {c[record.status]}
                    </span>
                  </div>
                  <div className="esim-pass-body">
                    <p className="eyebrow">{c.example}</p>
                    <h2>
                      <DestinationFlag destination={destination} />
                      {destination.name[locale]}
                    </h2>
                    <div className="esim-pass-allowance">
                      <Wifi size={18} />
                      <strong>{record.allowance} GB</strong>
                      <span>
                        <CalendarDays size={15} />
                        {record.days} {c.days}
                      </span>
                    </div>
                    <p className="experience-muted">
                      {record.status === "active"
                        ? `${record.allowance - record.used} GB ${c.remaining}`
                        : c[`${record.status}Body`]}
                    </p>
                  </div>
                  <div className="pass-tear" aria-hidden="true" />
                  <Link
                    className="esim-pass-link"
                    aria-label={`${c.viewEsim} ${destination.name[locale]}`}
                    href={experiencePath(locale, "wallet", { esim: record.id })}
                  >
                    {c.viewEsim} {destination.name[locale]}
                    <ArrowRight size={18} />
                  </Link>
                </article>
              );
            })}
          </div>
          {!records.length && <p className="experience-empty">{c.noFilter}</p>}
          <div className="wallet-explore">
            <Globe2 size={25} />
            <div>
              <h2>{c.noTrips}</h2>
              <p>{c.coverageBody}</p>
            </div>
            <ActionLink href={pathFor(locale, "destinations")}>
              {c.catalog}
            </ActionLink>
          </div>
        </>
      )}
    </div>
  );
}
