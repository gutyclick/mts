import Image from "next/image";
import { Globe2 } from "lucide-react";
import type { Destination } from "@/lib/catalog";
export function DestinationFlag({
  destination,
  className = "",
}: {
  destination: Pick<Destination, "code" | "type">;
  className?: string;
}) {
  return (
    <span className={`destination-flag ${className}`} aria-hidden="true">
      {destination.type === "country" ? (
        <Image
          src={`/flags/${destination.code.toLowerCase()}.svg`}
          alt=""
          width={32}
          height={32}
        />
      ) : (
        <Globe2 size={23} strokeWidth={1.8} />
      )}
    </span>
  );
}
