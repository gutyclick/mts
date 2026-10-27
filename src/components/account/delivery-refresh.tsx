"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { Locale } from "@/lib/i18n";

export function DeliveryRefresh({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [automatic, setAutomatic] = useState(true);
  useEffect(() => {
    let checks = 0;
    const timer = setInterval(() => {
      if (++checks >= 120) {
        clearInterval(timer);
        setAutomatic(false);
        return;
      }
      if (document.visibilityState === "visible") router.refresh();
    }, 5000);
    return () => clearInterval(timer);
  }, [router]);
  return (
    <div className="delivery-refresh" role="status">
      <p>
        {locale === "es"
          ? automatic
            ? "Estamos preparando tu conexión. Esta página se actualiza sola; no necesitas volver a comprar."
            : "Tu pedido sigue guardado. Puedes actualizar el estado o contactar con SIM si necesitas ayuda."
          : automatic
            ? "We’re preparing your connection. This page updates automatically; you don’t need to buy again."
            : "Your order is saved. Refresh its status or contact SIM if you need help."}
      </p>
      <button
        type="button"
        className="button button-secondary"
        onClick={() => router.refresh()}
      >
        <RefreshCw size={16} />
        {locale === "es" ? "Actualizar estado" : "Refresh status"}
      </button>
    </div>
  );
}
