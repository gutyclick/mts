"use client";

import { useEffect, useRef, useState } from "react";
import type { Locale } from "@/lib/i18n";
import { businessMessage } from "./portal-business-copy";

type PaymentParameters = {
  transactionId: string;
  token: string;
  documentName: string;
};
type YappyButton = HTMLElement & {
  isButtonLoading: boolean;
  eventPayment: (parameters: PaymentParameters) => void;
};
// The official module registers one custom element; never mix test/live modules.
let moduleLoad: { live: boolean; promise: Promise<void> } | null = null;
function loadButton(live: boolean) {
  if (moduleLoad) {
    return moduleLoad.live === live
      ? moduleLoad.promise
      : Promise.reject(Error("not_configured"));
  }
  const script = document.createElement("script");
  script.type = "module";
  script.src = live
    ? "https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js"
    : "https://bt-cdn-uat.yappycloud.com/v1/cdn/web-component-btn-yappy.js";
  const promise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(Error("unavailable")), 20000);
    script.addEventListener(
      "error",
      () => {
        clearTimeout(timeout);
        reject(Error("unavailable"));
      },
      { once: true },
    );
    customElements.whenDefined("btn-yappy").then(() => {
      clearTimeout(timeout);
      resolve();
    });
    document.head.appendChild(script);
  });
  moduleLoad = { live, promise };
  return promise;
}

export function YappyPayment({
  orderId,
  live,
  locale,
  onRefresh,
  onCreate,
  disabled = false,
}: {
  orderId: string;
  live: boolean;
  locale: Locale;
  onRefresh: () => void;
  onCreate?: (signal: AbortSignal) => Promise<PaymentParameters>;
  disabled?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const refresh = useRef(onRefresh);
  const create = useRef(onCreate);
  const blocked = useRef(disabled);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const es = locale === "es";
  useEffect(() => {
    refresh.current = onRefresh;
    create.current = onCreate;
    blocked.current = disabled;
  }, [onRefresh, onCreate, disabled]);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let disposed = false;
    let active = false;
    let button: YappyButton | null = null;
    const controller = new AbortController();
    const failed = () => {
      if (disposed) return;
      active = false;
      if (button) button.isButtonLoading = false;
      setError(
        es
          ? "No pudimos completar el pago con Yappy. Actualiza el estado antes de volver a intentarlo."
          : "We could not complete the Yappy payment. Refresh the status before trying again.",
      );
      refresh.current();
    };
    const succeeded = () => {
      if (disposed) return;
      active = false;
      if (button) button.isButtonLoading = false;
      setNotice(
        es
          ? "Yappy informó que la transacción terminó. Estamos esperando la verificación del pago en el servidor."
          : "Yappy reported that the transaction finished. We are waiting for server payment verification.",
      );
      refresh.current();
    };
    const clicked = async () => {
      if (disposed || active || !button || blocked.current) return;
      active = true;
      button.isButtonLoading = true;
      setError("");
      setNotice("");
      try {
        let value: PaymentParameters;
        if (create.current) value = await create.current(controller.signal);
        else {
          const response = await fetch("/api/portal/commerce", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "yappy", orderId }),
            signal: controller.signal,
          });
          const payload = await response.json();
          if (!response.ok) throw Error(payload.error ?? "unavailable");
          value = payload;
        }
        const valid = (value: unknown): value is string =>
          typeof value === "string" && value.length > 0 && value.length <= 4096;
        if (
          !valid(value.transactionId) ||
          !valid(value.token) ||
          !valid(value.documentName)
        )
          throw Error("unavailable");
        if (!disposed)
          button.eventPayment({
            transactionId: value.transactionId,
            token: value.token,
            documentName: value.documentName,
          });
      } catch (error) {
        if (!disposed) {
          active = false;
          button.isButtonLoading = false;
          setError(
            businessMessage(
              error instanceof Error ? error.message : "unavailable",
              locale,
            ),
          );
        }
      }
    };
    loadButton(live)
      .then(() => {
        if (disposed) return;
        button = document.createElement("btn-yappy") as YappyButton;
        button.setAttribute("theme", "blue");
        button.setAttribute("rounded", "true");
        button.addEventListener("eventClick", clicked);
        button.addEventListener("eventSuccess", succeeded);
        button.addEventListener("eventError", failed);
        container.appendChild(button);
      })
      .catch(() => {
        if (!disposed)
          setError(
            es
              ? "No se pudo cargar Yappy. Recarga la página para volver a intentarlo."
              : "Yappy could not load. Reload the page to try again.",
          );
      });
    return () => {
      disposed = true;
      controller.abort();
      if (button) {
        button.removeEventListener("eventClick", clicked);
        button.removeEventListener("eventSuccess", succeeded);
        button.removeEventListener("eventError", failed);
        button.remove();
      }
    };
  }, [orderId, live, locale, es]);
  return (
    <div>
      <div
        ref={host}
        inert={disabled}
        aria-disabled={disabled}
        aria-label={es ? "Pagar con Yappy" : "Pay with Yappy"}
      />
      {error && (
        <p className="bc-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="bc-notice" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
