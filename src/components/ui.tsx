import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, type LucideIcon } from "lucide-react";

export function IconBadge({
  icon: Icon,
  tone = "blue",
  className = "",
}: {
  icon: LucideIcon;
  tone?: "blue" | "orange";
  className?: string;
}) {
  return (
    <span
      className={`icon-badge icon-badge-${tone} ${className}`}
      aria-hidden="true"
    >
      <Icon size={21} strokeWidth={1.8} />
    </span>
  );
}

export function Brand() {
  return (
    <span className="brand">
      <svg viewBox="0 0 36 36" fill="none" aria-hidden="true">
        <path
          d="M7 17 6 5l10 6h4L30 5l-1 12c4 12-3 16-11 16S3 29 7 17Z"
          fill="currentColor"
        />
        <path
          d="M12 21h1m10 0h1"
          stroke="white"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="m16 25 2 2 2-2"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>
        MyTrip<span className="brand-blue">Sim</span>
        <span className="brand-dot">.</span>
      </span>
    </span>
  );
}
export function ButtonLink({
  href,
  children,
  secondary = false,
  className = "",
}: {
  href: string;
  children: ReactNode;
  secondary?: boolean;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`button ${secondary ? "button-secondary" : "button-primary"} ${className}`}
    >
      {children}
    </Link>
  );
}
export function SectionHeading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {description && <p className="section-description">{description}</p>}
      </div>
      {children}
    </div>
  );
}
export function ArrowLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link className="text-link" href={href}>
      {children}
      <ArrowUpRight size={17} />
    </Link>
  );
}
