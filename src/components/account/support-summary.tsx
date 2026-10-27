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
    { data, count, error } = await db
      .from("support_threads")
      .select("id,subject,status", { count: "exact" })
      .eq("user_id", userId)
      .not("escalated_at", "is", null)
      .order("updated_at", { ascending: false })
      .limit(3);
  return (
    <section className="customer-support-summary">
      <div className="customer-support-title">
        <span>
          <Headphones size={22} />
        </span>
        <div>
          <h2>{es ? "Mis tickets" : "My tickets"}</h2>
          <p>
            {es
              ? "Consulta el historial y las respuestas de nuestro equipo."
              : "Read your history and replies from our team."}
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
      {!data?.length && !error && (
        <p className="trip-ticket-empty">
          {es
            ? "Todavía no tienes tickets. Cuando solicites ayuda al equipo, podrás seguirla aquí."
            : "You have no tickets yet. Requests you send to our team will appear here."}
        </p>
      )}
      {error && (
        <p className="trip-ticket-empty" role="alert">
          {es
            ? "No pudimos cargar tus tickets. Abre el historial para volver a intentarlo."
            : "We couldn’t load your tickets. Open your history to try again."}
        </p>
      )}
    </section>
  );
}
