"use client";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { MessageCircle, X } from "lucide-react";
import type { Locale } from "@/lib/i18n";

// Keep chat, validation and conversation UI out of the initial page bundle.
const ChatPanel = lazy(() =>
  import("./chat-panel").then((module) => ({ default: module.ChatPanel })),
);

export function SupportWidget({ locale }: { locale: Locale }) {
  const path = usePathname();
  return <WidgetDialog key={path} locale={locale} />;
}
function WidgetDialog({ locale }: { locale: Locale }) {
  const [open, setOpen] = useState(false),
    dialog = useRef<HTMLDialogElement>(null),
    es = locale === "es";
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  return (
    <>
      <button
        className="support-launcher"
        onClick={() => setOpen(true)}
        aria-label={
          es
            ? "Hablar con SIM, asistente de ayuda"
            : "Chat with SIM, help assistant"
        }
        aria-haspopup="dialog"
      >
        <MessageCircle size={23} />
        <span>{es ? "¿Te ayudo?" : "Need help?"}</span>
      </button>
      <dialog
        ref={dialog}
        className="support-dialog"
        aria-labelledby="sim-chat-title"
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }}
      >
        {open && (
          <Suspense
            fallback={
              <div className="support-loading-panel">
                <header className="support-chat-header">
                  <h2 id="sim-chat-title">SIM</h2>
                  <button
                    onClick={() => setOpen(false)}
                    aria-label={es ? "Cerrar ayuda" : "Close help"}
                  >
                    <X size={22} />
                  </button>
                </header>
                <p role="status">
                  {es ? "Preparando tu ayuda…" : "Getting your help ready…"}
                </p>
              </div>
            }
          >
            <ChatPanel
              key={locale}
              locale={locale}
              close={() => setOpen(false)}
            />
          </Suspense>
        )}
      </dialog>
    </>
  );
}
