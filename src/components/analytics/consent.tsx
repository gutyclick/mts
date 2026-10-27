"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { BarChart3, X } from "lucide-react";
import { type Locale, pathFor } from "@/lib/i18n";
import {
  browserStatsBlocked,
  recordStats,
  setStatsPermission,
} from "@/lib/analytics/client";
import { destinationFromPath, publicStatsPath } from "@/lib/analytics/model";
async function readPreference(signal?: AbortSignal) {
  let r = await fetch("/api/analytics/consent", { cache: "no-store", signal });
  if (!r.ok) throw Error();
  let data = await r.json();
  if (browserStatsBlocked() && data.choice === "yes") {
    r = await fetch("/api/analytics/consent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ choice: "no" }),
      signal,
    });
    if (!r.ok) throw Error();
    data = { ...data, ...(await r.json()) };
  }
  return {
    enabled: data.enabled === true,
    choice:
      data.choice === "yes"
        ? ("yes" as const)
        : data.choice === "no"
          ? ("no" as const)
          : null,
    blocked: data.blocked === true || browserStatsBlocked(),
    cleanupPending: data.cleanupPending === true,
  };
}
const Context = createContext({ open: () => {} });
export function StatsPreferences({ locale }: { locale: Locale }) {
  const { open } = useContext(Context);
  return (
    <button type="button" className="stats-preferences" onClick={open}>
      {locale === "es" ? "Preferencias de privacidad" : "Privacy preferences"}
    </button>
  );
}
export function StatsProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const es = locale === "es",
    path = usePathname(),
    dialog = useRef<HTMLDialogElement>(null),
    previousFocus = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<{
      enabled: boolean;
      choice: "yes" | "no" | null;
      blocked: boolean;
      cleanupPending: boolean;
    } | null>(null),
    [manual, setManual] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    readPreference(abort.signal)
      .then((next) => {
        setStatsPermission(
          next.enabled && next.choice === "yes" && !next.blocked,
        );
        setState(next);
      })
      .catch(() => {});
    return () => {
      abort.abort();
      setStatsPermission(false);
    };
  }, []);
  useEffect(() => {
    if (!state?.enabled || state.choice !== "yes" || state.blocked) return;
    const destination = destinationFromPath(path);
    if (destination) recordStats("destination_view", destination);
  }, [path, state]);
  useEffect(() => {
    if (manual) {
      previousFocus.current = document.activeElement as HTMLElement;
      dialog.current?.showModal();
    } else {
      dialog.current?.close();
      previousFocus.current?.focus();
    }
  }, [manual]);
  const publicPage = publicStatsPath(path);
  async function choose(choice: "yes" | "no") {
    if (busy) return;
    if (choice === "no") setStatsPermission(false);
    setBusy(true);
    setError(false);
    try {
      const r = await fetch("/api/analytics/consent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ choice }),
      });
      if (!r.ok) throw Error();
      const data = await r.json(),
        accepted =
          data.choice === "yes" && !data.blocked && !browserStatsBlocked();
      setStatsPermission(accepted);
      setState((old) => ({
        enabled: old?.enabled ?? false,
        choice: accepted ? "yes" : "no",
        blocked: data.blocked === true || browserStatsBlocked(),
        cleanupPending: data.cleanupPending === true,
      }));
      setManual(data.cleanupPending === true);
      // Other open tabs stop immediately, without a persistent identifier or storage entry.
      const channel =
        typeof BroadcastChannel === "undefined"
          ? null
          : new BroadcastChannel("mts-privacy");
      channel?.postMessage("refresh");
      channel?.close();
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("mts-privacy");
    channel.onmessage = () => {
      setStatsPermission(false);
      readPreference()
        .then((next) => {
          setStatsPermission(
            next.enabled && next.choice === "yes" && !next.blocked,
          );
          setState(next);
        })
        .catch(() => {});
    };
    return () => channel.close();
  }, []);
  useEffect(() => {
    if (!state?.cleanupPending) return;
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const retry = async () => {
      try {
        const next = await readPreference(abort.signal);
        if (abort.signal.aborted) return;
        setState(next);
        if (next.cleanupPending) timer = setTimeout(() => void retry(), 60000);
      } catch {
        if (!abort.signal.aborted)
          timer = setTimeout(() => void retry(), 60000);
      }
    };
    timer = setTimeout(() => void retry(), 10000);
    return () => {
      abort.abort();
      clearTimeout(timer);
    };
  }, [state?.cleanupPending]);
  const card = (
    <>
      <div className="stats-heading">
        <span>
          <BarChart3 size={20} />
        </span>
        <h2 id={manual ? "stats-dialog-title" : "stats-banner-title"}>
          {es ? "Tu privacidad, tu elección" : "Your privacy, your choice"}
        </h2>
        {manual && (
          <button
            type="button"
            className="commerce-icon"
            aria-label={es ? "Cerrar" : "Close"}
            onClick={() => setManual(false)}
          >
            <X size={19} />
          </button>
        )}
      </div>
      <p>
        {es
          ? "Las funciones necesarias permiten comprar y usar tu eSIM. Si aceptas estadísticas opcionales, medimos qué destinos se consultan y cómo se completa la compra para mejorar la web. Sin publicidad de terceros."
          : "Necessary features let you buy and use your eSIM. If you accept optional statistics, we measure destination views and the purchase journey to improve our website. No third-party advertising."}
      </p>
      <Link href={pathFor(locale, "cookies")} onClick={() => setManual(false)}>
        {es
          ? "Ver cookies y conservación de datos"
          : "See cookies and data retention"}
      </Link>
      {manual && (
        <p className="stats-current">
          {state?.blocked
            ? es
              ? "Tu navegador solicita no realizar seguimiento. Las estadísticas están desactivadas."
              : "Your browser requests no tracking. Statistics are off."
            : state?.choice === "yes"
              ? es
                ? "Estadísticas activadas. Puedes retirar el permiso aquí."
                : "Statistics enabled. You can withdraw permission here."
              : es
                ? "Estadísticas desactivadas."
                : "Statistics disabled."}
        </p>
      )}
      {state?.cleanupPending && (
        <p role="status">
          {es
            ? "Las estadísticas están desactivadas. Reintentaremos borrar los datos de esta sesión cuando el servicio se recupere."
            : "Statistics are off. We will retry clearing this session’s data when the service recovers."}
        </p>
      )}
      {error && (
        <p role="alert">
          {es
            ? "No pudimos guardar la elección. Inténtalo de nuevo."
            : "We could not save your choice. Please try again."}
        </p>
      )}
      <div className="stats-actions">
        <button type="button" disabled={busy} onClick={() => void choose("no")}>
          {es ? "Solo necesarias" : "Necessary only"}
        </button>
        <button
          type="button"
          disabled={busy || state?.blocked || !state?.enabled}
          onClick={() => void choose("yes")}
        >
          {es ? "Aceptar estadísticas" : "Accept statistics"}
        </button>
      </div>
    </>
  );
  return (
    <Context.Provider value={{ open: () => setManual(true) }}>
      {children}
      {state?.enabled &&
        !state.choice &&
        !state.blocked &&
        publicPage &&
        !manual && (
          <aside
            className="stats-card stats-banner"
            aria-labelledby="stats-banner-title"
          >
            {card}
          </aside>
        )}
      <dialog
        className="stats-card stats-dialog"
        ref={dialog}
        aria-labelledby="stats-dialog-title"
        onCancel={() => setManual(false)}
        onClose={() => setManual(false)}
      >
        {manual && card}
      </dialog>
    </Context.Provider>
  );
}
