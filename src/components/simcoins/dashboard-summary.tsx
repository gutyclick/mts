import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import type { SimcoinsWallet } from "@/lib/simcoins/model";
import { LevelBadge } from "./art";

export function SimcoinsDashboardSummary({
  locale,
  wallet,
}: {
  locale: Locale;
  wallet: SimcoinsWallet;
}) {
  const es = locale === "es";
  const level =
    wallet.level.id === "traveler"
      ? es
        ? "Viajero"
        : "Traveler"
      : wallet.level.name;
  const n = (value: number) => new Intl.NumberFormat(locale).format(value);
  return (
    <Link
      className="trip-rewards-summary"
      href={`/${locale}/account/simcoins`}
      aria-label={
        es ? "Ver mis SimCoins y mi nivel" : "View my SimCoins and level"
      }
    >
      <LevelBadge id={wallet.level.id} size={48} />
      <div>
        <span>SimCoins · {level}</span>
        <strong>
          {n(wallet.availableCoins)} {es ? "disponibles" : "available"}
        </strong>
        <small>
          {wallet.pendingCoins > 0
            ? `${n(wallet.pendingCoins)} ${es ? "pendientes" : "pending"} · `
            : ""}
          {wallet.level.rateBps / 100}%{" "}
          {es ? "en compras elegibles" : "on eligible purchases"}
        </small>
      </div>
      <ArrowRight size={20} aria-hidden="true" />
    </Link>
  );
}
