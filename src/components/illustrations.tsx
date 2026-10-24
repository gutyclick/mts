import Image from "next/image";
import type { Destination } from "@/lib/catalog";
import type { Locale } from "@/lib/i18n";

// Replace assets independently of the surrounding cards or hero layout.
export function MascotIllustration({ className = "" }: { className?: string }) {
  return (
    <Image
      className={className}
      src="/images/traveler-cat.svg"
      alt=""
      width={440}
      height={440}
      loading="eager"
      fetchPriority="high"
    />
  );
}
export function DestinationArtwork({
  destination,
  locale,
  eager = false,
  sizes = "(max-width: 650px) 45vw, 30vw",
}: {
  destination: Destination;
  locale: Locale;
  eager?: boolean;
  sizes?: string;
}) {
  return (
    <Image
      className={
        destination.illustration
          ? "destination-artwork is-illustration"
          : "destination-artwork is-photograph"
      }
      src={destination.illustration ?? destination.image}
      alt={destination.name[locale]}
      fill
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
    />
  );
}
