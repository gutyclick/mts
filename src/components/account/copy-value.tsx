"use client";
import { useState } from "react";
import { Copy, Check } from "lucide-react";
import type { Locale } from "@/lib/i18n";
export function CopyValue({
  value,
  locale,
  label,
}: {
  value: string;
  locale: Locale;
  label: string;
}) {
  const [state, setState] = useState("");
  return (
    <div className="private-code">
      <code>{value}</code>
      <button
        className="button button-secondary"
        type="button"
        aria-label={`${locale === "es" ? "Copiar" : "Copy"} ${label}`}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setState(locale === "es" ? "Copiado" : "Copied");
          } catch {
            setState(
              locale === "es"
                ? "Selecciona el texto para copiarlo"
                : "Select the text to copy it",
            );
          }
        }}
      >
        {state ? <Check size={16} /> : <Copy size={16} />}
        <span>{state || (locale === "es" ? "Copiar" : "Copy")}</span>
      </button>
      <span className="sr-only" role="status">
        {state}
      </span>
    </div>
  );
}
