import Link from "next/link";
import { Coins, Clock3, ArrowUpRight } from "lucide-react";
import { DashboardShell } from "@/components/account/dashboard-shell";
import type { Locale } from "@/lib/i18n";
import type {
  SimcoinsPublicProgram,
  SimcoinsWallet,
} from "@/lib/simcoins/model";
import { simcoinsCopy } from "./copy";
import { LevelBadge, SimcoinIcon } from "./art";

export function SimcoinsWalletView({
  locale,
  name,
  esimCount,
  orderCount,
  program,
  wallet,
  configured,
}: {
  locale: Locale;
  name: string;
  esimCount: number;
  orderCount: number;
  program: SimcoinsPublicProgram;
  wallet: SimcoinsWallet;
  configured: boolean;
}) {
  const es = locale === "es";
  const activityNames: Record<string, [string, string]> = {
    EARN: ["Recompensa de compra", "Purchase reward"],
    RESERVE: ["Reserva para compra", "Purchase reservation"],
    RESERVATION: ["Reserva para compra", "Purchase reservation"],
    RELEASE_RESERVATION: ["Liberación de reserva", "Reservation release"],
    CONSUME: ["Canje en compra", "Purchase redemption"],
    REDEEM: ["Canje en compra", "Purchase redemption"],
    RELEASE_EARN: ["Recompensa disponible", "Reward released"],
    RELEASE: ["Liberación de monedas", "Coins released"],
    REFUND_EARN: [
      "Ajuste de recompensa por reembolso",
      "Refund reward adjustment",
    ],
    REFUND_REVERSAL: ["Ajuste por reembolso", "Refund adjustment"],
    REFUND_REDEEM: [
      "Restitución de canje por reembolso",
      "Refund redemption restoration",
    ],
    ADJUST: ["Ajuste de saldo", "Balance adjustment"],
    ADJUSTMENT: ["Ajuste de saldo", "Balance adjustment"],
  };
  const statusNames: Record<string, [string, string]> = {
    pending: ["Pendiente", "Pending"],
    available: ["Disponible", "Available"],
    reserved: ["Reservado", "Reserved"],
  };
  const n = (value: number) => new Intl.NumberFormat(locale).format(value);
  const cash = (value: number) =>
    new Intl.NumberFormat(locale, {
      style: "currency",
      currency: "USD",
    }).format(value / 100);
  const date = (value: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(value));
  const next = wallet.nextLevel;
  const firstPurchase = wallet.level.id === "traveler";
  const progress = next
    ? Math.min(
        100,
        Math.max(
          0,
          ((wallet.eligibleSpendCents - wallet.level.thresholdCents) /
            (next.thresholdCents - wallet.level.thresholdCents)) *
            100,
        ),
      )
    : 100;
  return (
    <DashboardShell
      locale={locale}
      section="simcoins"
      name={name}
      esimCount={esimCount}
      orderCount={orderCount}
    >
      <div className="sc-wallet">
        <div className="sc-wallet-heading">
          <div>
            <p className="sc-eyebrow">
              {es ? "TUS RECOMPENSAS" : "YOUR REWARDS"}
            </p>
            <h2>SimCoins</h2>
          </div>
          <Link href={`/${locale}/simcoins`} className="sc-text-link">
            {es ? "Conoce el programa" : "Explore the program"}
            <ArrowUpRight size={17} />
          </Link>
        </div>
        {!program.enabled && (
          <div className="sc-launch-note">
            <span>{simcoinsCopy[locale].preview}</span>
            <p>{simcoinsCopy[locale].off}</p>
          </div>
        )}
        {!configured && (
          <p className="sc-wallet-notice">
            {es
              ? "Tu monedero se está preparando. No hay recompensas disponibles para usar."
              : "Your wallet is being prepared. No rewards are available to use."}
          </p>
        )}
        <div className="sc-balances">
          <article className="sc-balance-main">
            <SimcoinIcon size={32} />
            <p>{es ? "Disponibles" : "Available"}</p>
            <strong>
              {n(wallet.availableCoins)} <small>SimCoins</small>
            </strong>
            <span>{cash(wallet.availableCoins)} USD</span>
          </article>
          <article>
            <Clock3 size={23} />
            <p>{es ? "Pendientes" : "Pending"}</p>
            <strong>{n(wallet.pendingCoins)}</strong>
            <span>{es ? "En período de espera" : "In the pending period"}</span>
          </article>
        </div>
        {wallet.reservedCoins > 0 && (
          <p>
            {es ? "Reservados en compras" : "Reserved for purchases"}:{" "}
            {n(wallet.reservedCoins)} SimCoins
          </p>
        )}
        {wallet.debtCoins > 0 && (
          <p className="sc-wallet-notice">
            {es ? "Ajuste pendiente de compensar" : "Adjustment to be covered"}:{" "}
            {n(wallet.debtCoins)} SimCoins.{" "}
            {es
              ? "El canje permanece bloqueado hasta compensarlo."
              : "Redemption remains blocked until it is covered."}
          </p>
        )}
        <section className="sc-wallet-level">
          <p className="sc-eyebrow">{es ? "NIVEL ACTUAL" : "CURRENT LEVEL"}</p>
          <div>
            <div className="sc-wallet-tier">
              <LevelBadge id={wallet.level.id} size={60} />
              <h3>
                {wallet.level.id === "traveler"
                  ? es
                    ? "Viajero"
                    : "Traveler"
                  : wallet.level.name}
              </h3>
            </div>
            <strong>{wallet.level.rateBps / 100}%</strong>
          </div>
          <p>
            {es ? "Gasto elegible acumulado" : "Cumulative eligible spending"}:{" "}
            {cash(wallet.eligibleSpendCents)}
          </p>
          {next ? (
            <>
              <div
                role="progressbar"
                aria-label={
                  es
                    ? "Progreso al próximo nivel"
                    : "Progress toward the next level"
                }
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress)}
                className="sc-progress"
              >
                <span style={{ width: `${progress}%` }} />
              </div>
              <p>
                {firstPurchase
                  ? es
                    ? "Completa tu primera compra elegible para llegar a Explorer. El 3% se aplica a las compras siguientes."
                    : "Complete your first eligible purchase to reach Explorer. The 3% rate applies to later purchases."
                  : es
                    ? `Te faltan ${cash(Math.max(0, next.thresholdCents - wallet.eligibleSpendCents))} para ${next.name}.`
                    : `${cash(Math.max(0, next.thresholdCents - wallet.eligibleSpendCents))} to reach ${next.name}.`}
              </p>
            </>
          ) : (
            <p>
              {es
                ? "Has alcanzado el nivel más alto."
                : "You have reached the highest level."}
            </p>
          )}
        </section>
        {wallet.pending.length > 0 && (
          <section className="sc-wallet-history">
            <h3>{es ? "Próximas liberaciones" : "Upcoming releases"}</h3>
            <ul>
              {wallet.pending.map((item) => (
                <li key={item.orderReference}>
                  <span>{item.orderReference}</span>
                  <strong>{n(item.coins)} SimCoins</strong>
                  <span>
                    {item.releaseAt
                      ? date(item.releaseAt)
                      : es
                        ? "Esperando entrega verificada"
                        : "Awaiting verified delivery"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <section className="sc-wallet-history">
          <h3>{es ? "Historial de movimientos" : "Activity history"}</h3>
          {wallet.history.length ? (
            <div className="sc-history-scroll">
              <table>
                <thead>
                  <tr>
                    <th>{es ? "Fecha" : "Date"}</th>
                    <th>{es ? "Movimiento" : "Activity"}</th>
                    <th>{es ? "Estado" : "Status"}</th>
                    <th>SimCoins</th>
                  </tr>
                </thead>
                <tbody>
                  {wallet.history.map((item) => (
                    <tr key={item.id}>
                      <td>{date(item.createdAt)}</td>
                      <td>
                        {item.reason ||
                          activityNames[item.type]?.[es ? 0 : 1] ||
                          (es ? "Movimiento de SimCoins" : "SimCoins activity")}
                        {item.orderReference && (
                          <small>{item.orderReference}</small>
                        )}
                      </td>
                      <td>
                        {statusNames[item.status]?.[es ? 0 : 1] ||
                          (es ? "Registrado" : "Recorded")}
                      </td>
                      <td>
                        {item.amountCoins > 0 ? "+" : ""}
                        {n(item.amountCoins)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="sc-empty">
              <Coins size={30} />
              <h4>
                {es ? "Tu recorrido empieza aquí" : "Your journey starts here"}
              </h4>
              <p>
                {es
                  ? "Todavía no hay movimientos de SimCoins. Aquí verás tus recompensas y ajustes cuando el programa esté disponible."
                  : "There is no SimCoins activity yet. Your rewards and adjustments will appear here when the program is available."}
              </p>
            </div>
          )}
        </section>
      </div>
    </DashboardShell>
  );
}
