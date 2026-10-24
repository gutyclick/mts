import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  FlaskConical,
  Wifi,
} from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { Destination } from "@/lib/catalog";
import type { Plan } from "@/lib/plan-utils";
import { experienceCopy } from "@/lib/experience-copy";
import { DestinationFlag } from "../destination-flag";
import { DestinationArtwork } from "../illustrations";
export function PreviewNotice({ locale }: { locale: Locale }) {
  const c = experienceCopy[locale];
  return (
    <aside className="experience-preview">
      <FlaskConical size={20} />
      <div>
        <strong>{c.preview}</strong>
        <p>{c.previewBody}</p>
      </div>
    </aside>
  );
}
export function ExperienceHeading({
  title,
  description,
  eyebrow,
}: {
  title: string;
  description: string;
  eyebrow?: string;
}) {
  return (
    <header className="experience-heading">
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  );
}
export function BackLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link className="back-link" href={href}>
      <ArrowLeft size={16} />
      {children}
    </Link>
  );
}
export function PassSummary({
  locale,
  destination,
  plan,
  children,
}: {
  locale: Locale;
  destination: Destination;
  plan: Plan;
  children?: React.ReactNode;
}) {
  const c = experienceCopy[locale];
  return (
    <aside className="travel-pass">
      <div className="travel-pass-art">
        <DestinationArtwork
          destination={destination}
          locale={locale}
          sizes="(max-width:650px) 90vw, 33vw"
        />
      </div>
      <div className="travel-pass-body">
        <p className="eyebrow">{c.plan}</p>
        <h2>
          <DestinationFlag destination={destination} />
          {destination.name[locale]}
        </h2>
        <p className="pass-plan-name">{plan.name}</p>
        <div className="pass-allowance">
          <Wifi size={23} />
          <strong>{plan.allowance}</strong>
        </div>
        <p className="pass-duration">
          <CalendarDays size={16} />
          {plan.days} {plan.days === 1 ? c.day : c.days}
          <span>{c[plan.kind]}</span>
        </p>
      </div>
      <div className="pass-tear" aria-hidden="true" />
      <div className="travel-pass-bottom">
        <div className="pass-price">
          <span>{c.noPrice}</span>
          <span>MYTRIPSIM</span>
        </div>
        {children}
      </div>
    </aside>
  );
}
export function ActionLink({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`button ${primary ? "button-primary" : "button-secondary"}`}
    >
      {children}
      <ArrowRight size={17} />
    </Link>
  );
}
