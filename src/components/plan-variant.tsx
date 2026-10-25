"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { planVariant } from "@/lib/plan-variants";
import type { Locale } from "@/lib/i18n";

export function PlanVariant({
  plan,
  locale,
}: {
  plan: { id: string; name: string };
  locale: Locale;
}) {
  const variant = planVariant(plan, locale);
  const id = useId();
  const button = useRef<HTMLButtonElement>(null);
  const tooltip = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    above: boolean;
  }>();
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  function show() {
    clearTimeout(timer.current);
    const rect = button.current?.getBoundingClientRect();
    if (rect)
      setPosition({
        left: Math.max(
          12,
          Math.min(
            rect.left,
            window.innerWidth - Math.min(300, window.innerWidth - 24) - 12,
          ),
        ),
        top:
          window.innerHeight - rect.bottom > 160
            ? rect.bottom + 8
            : rect.top - 8,
        above: window.innerHeight - rect.bottom <= 160,
      });
  }
  function hideSoon() {
    timer.current = setTimeout(() => setPosition(undefined), 150);
  }
  const isOpen = !!position;
  useEffect(() => {
    if (!isOpen) return;
    const close = () => setPosition(undefined);
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    const outside = (e: PointerEvent) => {
      if (
        !button.current?.contains(e.target as Node) &&
        !tooltip.current?.contains(e.target as Node)
      )
        close();
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("pointerdown", outside);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("pointerdown", outside);
      clearTimeout(timer.current);
    };
  }, [isOpen]);
  return (
    <span className="plan-variant-badge">
      <span>{variant.label}</span>
      <button
        ref={button}
        type="button"
        aria-label={`${locale === "es" ? "Qué significa" : "About"} ${variant.label}`}
        aria-describedby={isOpen ? id : undefined}
        aria-expanded={isOpen}
        onPointerEnter={show}
        onPointerLeave={hideSoon}
        onFocus={(e) => {
          if (e.currentTarget.matches(":focus-visible")) show();
        }}
        onBlur={() => setPosition(undefined)}
        onClick={show}
      >
        <Info size={16} aria-hidden="true" />
      </button>
      {position &&
        createPortal(
          <span
            ref={tooltip}
            id={id}
            role="tooltip"
            className="plan-variant-tooltip"
            style={{
              left: position.left,
              top: position.top,
              transform: position.above ? "translateY(-100%)" : undefined,
            }}
            onPointerEnter={() => clearTimeout(timer.current)}
            onPointerLeave={hideSoon}
          >
            {variant.description}
          </span>,
          document.body,
        )}
    </span>
  );
}
