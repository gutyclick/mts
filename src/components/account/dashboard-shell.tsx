import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import {
  Headphones,
  Package,
  UserRound,
  WalletCards,
  Coins,
} from "lucide-react";
import { experiencePath } from "@/lib/experience-routes";
import type { Locale } from "@/lib/i18n";
import type { DashboardSection } from "@/lib/customer-dashboard";
export function DashboardShell({
  locale,
  section,
  name,
  esimCount,
  orderCount,
  children,
}: {
  locale: Locale;
  section: DashboardSection;
  name: string;
  esimCount: number;
  orderCount: number;
  children: ReactNode;
}) {
  const es = locale === "es";
  const items = [
    {
      id: "esims",
      label: es ? "Mis TripSim" : "My TripSim",
      icon: WalletCards,
      count: esimCount,
    },
    {
      id: "orders",
      label: es ? "Pedidos" : "Orders",
      icon: Package,
      count: orderCount,
    },
    { id: "support", label: es ? "Soporte" : "Support", icon: Headphones },
    { id: "account", label: es ? "Cuenta" : "Account", icon: UserRound },
    { id: "simcoins", label: "SimCoins", icon: Coins },
  ] as const;
  return (
    <div className="container customer-account trip-dashboard">
      <header className="trip-dashboard-heading">
        <div>
          <p className="trip-greeting">
            {es ? "Hola" : "Hello"}, {name}
          </p>
          <h1>{es ? "Mis TripSim" : "My TripSim"}</h1>
          <p>
            {es
              ? "Instala tus eSIM y consulta tus pedidos."
              : "Install your eSIMs and manage your orders."}
          </p>
        </div>
        <Image
          className="trip-dashboard-mascot"
          src="/images/sim/sim_welcome_dashboard_user.webp"
          alt=""
          width={168}
          height={168}
          sizes="(max-width: 650px) 88px, 168px"
        />
      </header>
      <div className="trip-dashboard-layout">
        <aside className="trip-dashboard-sidebar">
          <nav aria-label={es ? "Mi cuenta" : "My account"}>
            {items.map((item) => (
              <Link
                key={item.id}
                href={
                  item.id === "simcoins"
                    ? `/${locale}/account/simcoins`
                    : experiencePath(
                        locale,
                        "wallet",
                        item.id === "esims" ? undefined : { section: item.id },
                      )
                }
                aria-current={section === item.id ? "page" : undefined}
              >
                <item.icon size={20} />
                <span
                  className={
                    item.id === "esims" ? "trip-nav-label-full" : undefined
                  }
                >
                  {item.label}
                </span>
                {item.id === "esims" && (
                  <span className="trip-nav-label-short">TripSim</span>
                )}
                {"count" in item && <small>{item.count}</small>}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="trip-dashboard-content" key={section}>
          {children}
        </div>
      </div>
    </div>
  );
}
