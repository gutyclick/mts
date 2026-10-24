"use client";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  FileText,
  Globe2,
  LayoutDashboard,
  Package,
  Search,
  Settings2,
  ShoppingBag,
} from "lucide-react";
import { searchDestinations } from "@/lib/catalog";
import { experienceCopy } from "@/lib/experience-copy";
import { helpContent } from "@/lib/help-content";
import { pathFor, type Locale } from "@/lib/i18n";
import { planPath } from "@/lib/experience-routes";
import type { Plan } from "@/lib/plan-utils";
import { DestinationFlag } from "../destination-flag";
import { ExperienceHeading, PreviewNotice } from "./shared";
export function AdminPreview({
  locale,
  samples,
}: {
  locale: Locale;
  samples: { slug: string; plan: Plan }[];
}) {
  const c = experienceCopy[locale];
  const [tab, setTab] = useState("destinations");
  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(10);
  const items = searchDestinations(query);
  const sections = [
    { key: "destinations", label: c.destinations, icon: Globe2 },
    { key: "plans", label: c.planCount, icon: Package },
    { key: "orders", label: c.demoOrders, icon: ShoppingBag },
    { key: "content", label: c.content, icon: FileText },
  ];
  return (
    <div className="container experience-page studio-page">
      <PreviewNotice locale={locale} />
      <ExperienceHeading
        eyebrow={c.workspace}
        title={c.studio}
        description={c.workspaceBody}
      />
      <div className="studio-layout">
        <aside className="studio-sidebar">
          <span className="studio-sidebar-title">
            <LayoutDashboard size={20} />
            MYTRIPSIM
          </span>
          <nav aria-label={c.workspace}>
            {sections.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                aria-pressed={tab === key}
                onClick={() => setTab(key)}
              >
                <Icon size={19} />
                {label}
              </button>
            ))}
          </nav>
          <p>
            <Settings2 size={16} />
            {c.saved}
          </p>
        </aside>
        <div className="studio-content">
          <div className="studio-stats">
            <div>
              <span>{c.destinations}</span>
              <strong>244</strong>
              <small>
                {locale === "es"
                  ? "202 países · 42 regiones"
                  : "202 countries · 42 regions"}
              </small>
            </div>
            <div>
              <span>{c.planCount}</span>
              <strong>3.186</strong>
              <small>
                {locale === "es"
                  ? "Catálogo sin precios"
                  : "Catalog without prices"}
              </small>
            </div>
            <div>
              <span>FAQ</span>
              <strong>29</strong>
              <small>
                {locale === "es"
                  ? "Preguntas por idioma"
                  : "Questions per language"}
              </small>
            </div>
          </div>
          <section className="experience-card studio-panel">
            <div className="card-title">
              <h2>{sections.find((section) => section.key === tab)?.label}</h2>
              <span className="sample-label">{c.preview}</span>
            </div>
            {tab === "destinations" && (
              <>
                <div className="directory-search">
                  <Search size={19} />
                  <label className="sr-only" htmlFor="studio-search">
                    {c.searchDestinations}
                  </label>
                  <input
                    id="studio-search"
                    type="search"
                    placeholder={c.searchDestinations}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setLimit(10);
                    }}
                  />
                </div>
                <div className="studio-table" role="list">
                  {items.slice(0, limit).map((destination) => (
                    <article
                      className="studio-row"
                      role="listitem"
                      key={destination.slug}
                    >
                      <div className="studio-destination">
                        <DestinationFlag destination={destination} />
                        <div>
                          <strong>{destination.name[locale]}</strong>
                          <small>
                            {destination.code} ·{" "}
                            {destination.type === "region"
                              ? locale === "es"
                                ? "Región"
                                : "Region"
                              : locale === "es"
                                ? "País / territorio"
                                : "Country / territory"}
                          </small>
                        </div>
                      </div>
                      <span>
                        {destination.planCount} {c.planCount.toLowerCase()}
                      </span>
                      <span
                        className={`studio-art-status ${destination.artworkKind === "banner" ? "has-banner" : ""}`}
                      >
                        {destination.artworkKind === "banner"
                          ? c.supplied
                          : c.fallback}
                      </span>
                      <Link
                        aria-label={`${c.reviewPlan}: ${destination.name[locale]}`}
                        href={pathFor(locale, undefined, destination.slug)}
                      >
                        <ArrowUpRight size={20} />
                      </Link>
                    </article>
                  ))}
                </div>
                {!items.length && (
                  <p className="studio-empty">
                    {locale === "es"
                      ? "No encontramos destinos con ese nombre."
                      : "No destinations match that name."}
                  </p>
                )}
                {items.length > limit && (
                  <button
                    className="button button-secondary"
                    onClick={() => setLimit(limit + 20)}
                  >
                    {locale === "es"
                      ? "Ver más destinos"
                      : "Show more destinations"}
                  </button>
                )}
              </>
            )}
            {tab === "plans" && (
              <>
                <p>{c.saved}</p>
                <div className="studio-table">
                  {samples.map(({ slug, plan }) => (
                    <article
                      className="studio-row studio-plan-row"
                      key={plan.id}
                    >
                      <div>
                        <strong>{plan.name}</strong>
                        <small>
                          {plan.allowance} · {plan.days} {c.days}
                        </small>
                      </div>
                      <span>{c[plan.kind]}</span>
                      <Link
                        href={planPath(locale, slug, plan.id)}
                        aria-label={`${c.fullDetails}: ${plan.name}`}
                      >
                        <ArrowUpRight size={20} />
                      </Link>
                    </article>
                  ))}
                </div>
              </>
            )}
            {tab === "orders" && (
              <>
                <p>{c.noOrders}</p>
                <div className="studio-table">
                  {[
                    { id: "DEMO-JP101", name: "Japan", status: c.ready },
                    { id: "DEMO-FR202", name: "France", status: c.active },
                    { id: "DEMO-US303", name: "USA", status: c.ended },
                  ].map((order) => (
                    <article
                      className="studio-row studio-order-row"
                      key={order.id}
                    >
                      <strong>{order.id}</strong>
                      <span>{order.name}</span>
                      <span className="sample-label">{order.status}</span>
                    </article>
                  ))}
                </div>
              </>
            )}
            {tab === "content" && (
              <>
                <p>{c.saved}</p>
                <div className="studio-articles">
                  {helpContent[locale].categories.map((category) => (
                    <article key={category.id}>
                      <FileText size={22} />
                      <div>
                        <h3>{category.title}</h3>
                        <p>
                          {category.questions.length}{" "}
                          {helpContent[locale].questions}
                        </p>
                      </div>
                      <Link
                        href={`${pathFor(locale, "faq")}#${category.id}`}
                        aria-label={`${c.editContent}: ${category.title}`}
                      >
                        <ArrowUpRight size={20} />
                      </Link>
                    </article>
                  ))}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
