import Image from "next/image";
import type { Locale } from "@/lib/i18n";

const illustrations = {
  paymentHold: {
    src: "/images/sim/sim_payment_hold.png",
    es: "SIM junto a una tarjeta y un reloj de arena, esperando que completes tu pago",
    en: "SIM beside a card and an hourglass, waiting for you to complete payment",
  },
  traveler: {
    src: "/images/sim/sim_traveler.png",
    es: "SIM, la mascota de MyTripSim, viajando con su maleta",
    en: "SIM, the MyTripSim mascot, travelling with a suitcase",
  },
  help: {
    src: "/images/sim/sim_help.png",
    es: "SIM con sus auriculares y un teléfono, listo para ayudarte",
    en: "SIM wearing a headset and holding a phone, ready to help",
  },
  adventurer: {
    src: "/images/sim/sim_adeventurer.png",
    es: "SIM aventurero volando sobre una tarjeta SIM",
    en: "SIM the adventurer flying on a SIM card",
  },
} as const;

export function SimMascot({
  variant,
  locale,
  className = "",
  sizes,
  eager = false,
}: {
  variant: keyof typeof illustrations;
  locale: Locale;
  className?: string;
  sizes: string;
  eager?: boolean;
}) {
  const illustration = illustrations[variant];
  return (
    <Image
      className={`sim-mascot ${className}`}
      src={illustration.src}
      alt={illustration[locale]}
      width={1280}
      height={1280}
      sizes={sizes}
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
    />
  );
}
