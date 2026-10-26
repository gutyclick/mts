"use client";
import { ArrowLeft, X } from "lucide-react";
import { SimMascot } from "../sim-mascot";
import type { Locale } from "@/lib/i18n";
export function MessengerHeader({
  locale,
  ai,
  close,
  back,
}: {
  locale: Locale;
  ai: boolean;
  close: () => void;
  back?: () => void;
}) {
  const es = locale === "es";
  return (
    <header className="support-chat-header messenger-header">
      {back && (
        <button
          className="support-icon-button messenger-back"
          onClick={back}
          aria-label={es ? "Ver conversaciones" : "View conversations"}
        >
          <ArrowLeft size={19} />
        </button>
      )}
      <div className="support-avatar">
        <SimMascot variant="help" locale={locale} sizes="64px" />
      </div>
      <div className="messenger-header-copy">
        <h2 id="sim-chat-title">
          SIM {es ? "te acompaña" : "is here to help"}
          <span
            className={`support-online-dot${ai ? " is-online" : ""}`}
            role="img"
            aria-label={
              ai
                ? es
                  ? "SIM disponible"
                  : "SIM available"
                : es
                  ? "Conexión por confirmar"
                  : "Connection unconfirmed"
            }
          />
        </h2>
        <p>{es ? "Una mano para tu viaje" : "A hand for your journey"}</p>
      </div>
      <button
        className="support-icon-button"
        onClick={close}
        aria-label={es ? "Minimizar chat" : "Minimize chat"}
      >
        <X size={20} />
      </button>
    </header>
  );
}
