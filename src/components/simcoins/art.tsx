import Image from "next/image";
import type { CSSProperties } from "react";
import { Globe2 } from "lucide-react";
import "@/styles/simcoins-art.css";

const badges: Record<string, string> = {
  traveler: "badge_traveler",
  explorer: "badge_explorer",
  adventurer: "badge_adventurer",
  globetrotter: "badge_globetrotter",
  legend: "badge_legend",
};

export function SimcoinIcon({ size = 28 }: { size?: number }) {
  return (
    <Image
      className="simcoin-icon"
      src="/images/simcoins/simcoins_one.webp"
      alt=""
      width={size}
      height={size}
      sizes={`${size}px`}
    />
  );
}

export function LevelBadge({ id, size = 100 }: { id: string; size?: number }) {
  const badge = badges[id];
  return badge ? (
    <Image
      className="simcoins-level-badge"
      src={`/images/simcoins/${badge}.webp`}
      alt=""
      width={size}
      height={size}
      sizes={`${size}px`}
    />
  ) : (
    <span
      className="simcoins-level-fallback"
      aria-hidden="true"
      style={{ "--badge-size": `${size}px` } as CSSProperties}
    >
      <Globe2 size={size * 0.55} strokeWidth={1.6} />
    </span>
  );
}
