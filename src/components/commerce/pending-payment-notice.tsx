"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowRight, Clock3 } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import { pendingPaymentKey } from "@/lib/payments/hold-policy";
import { forgetPayment } from "./payment-hold";
function snapshot() {
  try {
    const value = localStorage.getItem(pendingPaymentKey);
    return value && /^[a-f0-9-]{36}$/i.test(value) ? value : null;
  } catch {
    return null;
  }
}
function subscribe(update: () => void) {
  window.addEventListener("storage", update);
  window.addEventListener("mytripsim:pending-payment", update);
  return () => {
    window.removeEventListener("storage", update);
    window.removeEventListener("mytripsim:pending-payment", update);
  };
}
export function PendingPaymentNotice({ locale }: { locale: Locale }) {
  const pathname = usePathname(),
    id = useSyncExternalStore(subscribe, snapshot, () => null);
  const [visible, setVisible] = useState<string | null>(null);
  const inCheckout = /\/(compra|checkout)(\/|$)/.test(pathname);
  useEffect(() => {
    if (!id || inCheckout) return;
    const controller = new AbortController();
    fetch(`/api/checkout/status?order=${id}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok) return;
        const data = await response.json();
        if (data.status === "pending") setVisible(id);
        else {
          forgetPayment(id);
          setVisible(null);
        }
      })
      .catch(() => {});
    return () => controller.abort();
  }, [id, inCheckout, pathname]);
  if (inCheckout || !id || visible !== id) return null;
  return (
    <aside className="container pending-payment-notice">
      <Clock3 size={18} />
      <span>
        {locale === "es"
          ? "Tienes un pago pendiente."
          : "You have a pending payment."}
      </span>
      <Link href={`/${locale}/checkout/result?order=${id}`}>
        {locale === "es" ? "Completar el pago" : "Complete payment"}
        <ArrowRight size={16} />
      </Link>
    </aside>
  );
}
