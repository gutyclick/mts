import Link from "next/link";
import Image from "next/image";
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
      <Image
        src="/images/mytripsimlogo-web.svg"
        alt="MyTripSim"
        width={3551}
        height={737}
        className="brand-logo"
        loading="eager"
        unoptimized
      />
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
