import Link from "next/link";
import {
  Activity,
  ArrowLeft,
  LayoutDashboard,
  LifeBuoy,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { Brand } from "../ui";
import type { Locale } from "@/lib/i18n";
export function OperationsShell({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const es = locale === "es";
  return (
    <div className="admin-workspace">
      <aside className="admin-sidebar">
        <Link
          href={`/${locale}`}
          className="admin-brand"
          aria-label="MyTripSim"
        >
          <Brand />
        </Link>
        <p className="admin-workspace-label">
          <ShieldCheck size={14} />
          {es ? "ADMINISTRACIÓN" : "ADMINISTRATION"}
        </p>
        <nav aria-label={es ? "Administración" : "Administration"}>
          <Link className="admin-support-link" href={`/${locale}/admin`}>
            <LayoutDashboard size={20} />
            {es ? "Resumen" : "Overview"}
          </Link>
          <Link
            className="admin-support-link"
            href={`/${locale}/admin/operations`}
          >
            <Activity size={20} />
            {es ? "Operaciones" : "Operations"}
          </Link>
          <Link
            className="admin-support-link"
            href={`/${locale}/admin/refunds`}
          >
            <RotateCcw size={20} />
            {es ? "Reembolsos" : "Refunds"}
          </Link>
          <Link
            className="admin-support-link"
            href={`/${locale}/admin/tickets`}
          >
            <LifeBuoy size={20} />
            {es ? "Tickets de ayuda" : "Support tickets"}
          </Link>
        </nav>
        <Link className="admin-support-link" href={`/${locale}`}>
          <ArrowLeft size={17} />
          {es ? "Volver a la web" : "Back to website"}
        </Link>
      </aside>
      <main className="operations-main">{children}</main>
    </div>
  );
}
