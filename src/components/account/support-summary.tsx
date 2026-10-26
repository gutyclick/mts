import Link from "next/link";
import { ArrowRight, Headphones, Ticket } from "lucide-react";
import { authClient } from "@/lib/supabase/auth-server";
import type { Locale } from "@/lib/i18n";
export async function CustomerSupportSummary({
  locale,
  userId,
}: {
  locale: Locale;
  userId: string;
}) {
  const es = locale === "es",
    db = await authClient(),
    { data, count } = await db
      .from("support_threads")
      .select("id,subject,status", { count: "exact" })
      .eq("user_id", userId)
      .neq("status", "chat")
      .order("updated_at", { ascending: false })
      .limit(3);
  return (
    <section className="customer-support-summary">
      <div className="customer-support-title">
        <span>
          <Headphones size={22} />
        </span>
        <div>
          <h2>{es ? "Ayuda y tickets" : "Help & tickets"}</h2>
          <p>
            {es
              ? "Consulta tus conversaciones o pide ayuda a nuestro equipo."
              : "Read your conversations or ask our team for help."}
          </p>
        </div>
        <Link className="button button-secondary" href={`/${locale}/support`}>
          {es ? "Ver mis tickets" : "View my tickets"}
          {count ? ` (${count})` : ""}
          <ArrowRight size={16} />
        </Link>
      </div>
      {!!data?.length && (
        <div className="customer-support-recent">
          {data.map((t) => (
            <Link key={t.id} href={`/${locale}/support?ticket=${t.id}`}>
              <Ticket size={17} />
              <strong>{t.subject}</strong>
              <small>
                {t.status === "resolved"
                  ? es
                    ? "Resuelto"
                    : "Resolved"
                  : t.status === "waiting_customer"
                    ? es
                      ? "Tienes una respuesta"
                      : "You have a reply"
                    : es
                      ? "En revisión"
                      : "Under review"}
              </small>
              <ArrowRight size={15} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
