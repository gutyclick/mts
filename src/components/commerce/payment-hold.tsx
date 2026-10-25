"use client";
import { useEffect, useRef, useState } from "react";
import { Clock3 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Locale } from "@/lib/i18n";
import {
  pendingPaymentKey,
  remainingHoldSeconds,
} from "@/lib/payments/hold-policy";
export function rememberPayment(id: string) {
  try {
    localStorage.setItem(pendingPaymentKey, id);
    window.dispatchEvent(new Event("mytripsim:pending-payment"));
  } catch {}
}
export function forgetPayment(id: string) {
  try {
    if (localStorage.getItem(pendingPaymentKey) === id) {
      localStorage.removeItem(pendingPaymentKey);
      window.dispatchEvent(new Event("mytripsim:pending-payment"));
    }
  } catch {}
}
export function markPaymentLeave(id: string) {
  const body = JSON.stringify({ orderId: id, action: "leave" });
  try {
    if (
      navigator.sendBeacon?.(
        "/api/checkout/presence",
        new Blob([body], { type: "application/json" }),
      )
    )
      return;
  } catch {}
  void fetch("/api/checkout/presence", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
export function HoldCountdown({
  deadline,
  serverTime,
  locale,
  onElapsed,
}: {
  deadline: string;
  serverTime: string;
  locale: Locale;
  onElapsed?: () => void;
}) {
  const [now, setNow] = useState(() => new Date(serverTime).getTime());
  const called = useRef(false);
  useEffect(() => {
    const start = Date.now(),
      serverStart = new Date(serverTime).getTime();
    const update = () => setNow(serverStart + Date.now() - start);
    const interval = setInterval(update, 1000);
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", update);
    };
  }, [serverTime]);
  const remaining = remainingHoldSeconds(deadline, now) ?? 0;
  useEffect(() => {
    if (!remaining && !called.current) {
      called.current = true;
      onElapsed?.();
    }
  }, [remaining, onElapsed]);
  return (
    <div
      className={`payment-hold-clock ${remaining <= 60 ? "payment-hold-urgent" : ""}`}
    >
      <Clock3 size={20} />
      <div>
        <span>
          {locale === "es"
            ? "Tiempo para completar el pago"
            : "Time to complete payment"}
        </span>
        <strong role="timer" aria-live="off">
          {String(Math.floor(remaining / 60)).padStart(2, "0")}:
          {String(remaining % 60).padStart(2, "0")}
        </strong>
      </div>
    </div>
  );
}
export function usePaymentPresence(
  orderId: string,
  element: React.RefObject<HTMLElement | null>,
) {
  const router = useRouter();
  const [state, setState] = useState<{
    holdExpiresAt: string | null;
    serverTime: string;
    status: string;
    paymentInProgress: boolean;
  } | null>(null);
  const [now, setNow] = useState(0);
  const offset = useRef(0);
  useEffect(() => {
    rememberPayment(orderId);
    const node = element.current;
    let disposed = false;
    async function active() {
      if (document.hidden) return;
      setNow(Date.now() - offset.current);
      try {
        const response = await fetch("/api/checkout/presence", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId, action: "active" }),
        });
        if (!response.ok) return;
        const data = await response.json();
        if (disposed) return;
        offset.current = Date.now() - new Date(data.serverTime).getTime();
        setState(data);
        setNow(Date.now() - offset.current);
        if (data.status !== "pending" || data.paymentInProgress)
          router.replace(
            `/${document.documentElement.lang === "es" ? "es" : "en"}/checkout/result?order=${orderId}`,
          );
      } catch {}
    }
    const leave = () => markPaymentLeave(orderId);
    const visibility = () => {
      if (document.hidden) leave();
      else void active();
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", leave);
    window.addEventListener("pageshow", active);
    const heartbeat = setInterval(active, 15000);
    const clock = setInterval(() => setNow(Date.now() - offset.current), 1000);
    void active();
    return () => {
      disposed = true;
      clearInterval(heartbeat);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("pageshow", active);
      setTimeout(() => {
        if (!node?.isConnected) leave();
      }, 0);
    };
  }, [orderId, element, router]);
  const elapsed = state?.holdExpiresAt
    ? (remainingHoldSeconds(state.holdExpiresAt, now) ?? 1) === 0
    : false;
  useEffect(() => {
    if (elapsed)
      router.replace(
        `/${document.documentElement.lang === "es" ? "es" : "en"}/checkout/result?order=${orderId}`,
      );
  }, [elapsed, orderId, router]);
  return { state, elapsed };
}
