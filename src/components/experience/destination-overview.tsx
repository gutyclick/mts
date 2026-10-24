import Link from "next/link";
import { CalendarDays, Globe2, Smartphone, Wifi } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { pathFor } from "@/lib/i18n";
import type { Destination } from "@/lib/catalog";
import type { Plan } from "@/lib/plan-utils";
import { experienceCopy } from "@/lib/experience-copy";
export function DestinationOverview({
  locale,
  destination,
  plans,
}: {
  locale: Locale;
  destination: Destination;
  plans: Plan[];
}) {
  const c = experienceCopy[locale];
  const days = plans.map((p) => p.days);
  return (
    <>
      <nav
        className="destination-section-nav"
        aria-label={
          locale === "es" ? "Explorar este destino" : "Explore this destination"
        }
      >
        <a href="#destination-plans">{c.allPlans}</a>
        <a href="#destination-coverage">{c.coverage}</a>
        <a href="#destination-setup">{c.installation}</a>
      </nav>
      <section className="destination-facts" aria-label={c.overview}>
        {[
          {
            icon: Wifi,
            title: `${destination.planCount} ${c.options}`,
            body: `${destination.dataMinGb < 1 ? `${destination.dataMinGb * 1000}MB` : `${destination.dataMinGb}GB`} – ${destination.dataMaxGb}GB`,
          },
          {
            icon: CalendarDays,
            title: c.duration,
            body: `${Math.min(...days)} – ${Math.max(...days)} ${c.days}`,
          },
          { icon: Globe2, title: c.coverage, body: destination.name[locale] },
          { icon: Smartphone, title: c.installation, body: c.compatibility },
        ].map(({ icon: Icon, title, body }) => (
          <div key={title}>
            <span className="learning-icon">
              <Icon size={21} />
            </span>
            <div>
              <strong>{title}</strong>
              <p>{body}</p>
            </div>
          </div>
        ))}
      </section>
      <p className="destination-check-link">
        <Link href={pathFor(locale, "compatibility")}>{c.compatibility}</Link>
      </p>
    </>
  );
}
