"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState } from "react";
import { Maximize2, X, ZoomIn, ZoomOut, ExternalLink } from "lucide-react";
import type { Locale } from "@/lib/i18n";
import "@/styles/instruction-gallery.css";

const instructions = {
  iphone: {
    file: "Instala tu eSIM en iPhone.png",
    width: 2172,
    title: { es: "Instalar en iPhone", en: "Install on iPhone" },
    device: "iPhone",
  },
  android: {
    file: "Guía Android para instalar tu eSIM.png",
    width: 2172,
    title: { es: "Instalar en Android", en: "Install on Android" },
    device: "Samsung",
  },
  data: {
    file: "Configura tu eSIM para datos móviles - paso 1.png",
    width: 2172,
    title: { es: "Elegir la eSIM para datos", en: "Choose your eSIM for data" },
    device: "iPhone",
  },
  roaming: {
    file: "Activa el roaming de tu eSIM paso 2.png",
    width: 2171,
    title: { es: "Activar el roaming", en: "Enable data roaming" },
    device: "iPhone",
  },
} as const;
export type InstructionId = keyof typeof instructions;
export function InstructionGallery({
  locale,
  guides,
}: {
  locale: Locale;
  guides: InstructionId[];
}) {
  const es = locale === "es";
  const [selected, setSelected] = useState<InstructionId | null>(null);
  const [zoom, setZoom] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const active = selected ? instructions[selected] : null;
  useEffect(() => {
    if (!selected) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [selected]);
  function close() {
    dialog.current?.close();
    setSelected(null);
    setZoom(false);
  }
  const src = (file: string) => `/images/instructivos/${file}`;
  return (
    <div className="instruction-gallery">
      {guides.map((key) => {
        const guide = instructions[key];
        return (
          <button
            key={key}
            type="button"
            className="instruction-thumbnail"
            aria-haspopup="dialog"
            onClick={() => {
              setZoom(false);
              setSelected(key);
            }}
          >
            <Image
              src={src(guide.file)}
              alt=""
              width={guide.width}
              height={724}
              sizes="120px"
              className="instruction-preview"
            />
            <span>
              <strong>{guide.title[locale]}</strong>
              <small>
                {guide.device} · {es ? "Ver imagen" : "View image"}
                <Maximize2 size={13} aria-hidden="true" />
              </small>
            </span>
          </button>
        );
      })}
      {active && (
        <dialog
          ref={dialog}
          className="instruction-dialog"
          aria-labelledby={`${id}-title`}
          aria-describedby={`${id}-hint`}
          onCancel={(event) => {
            event.preventDefault();
            close();
          }}
          onClick={(event) => {
            if (event.target === event.currentTarget) close();
          }}
          onClose={() => {
            setSelected(null);
            setZoom(false);
          }}
        >
          <div className="instruction-dialog-header">
            <h2 id={`${id}-title`}>{active.title[locale]}</h2>
            <button
              type="button"
              className="instruction-close"
              onClick={close}
              aria-label={es ? "Cerrar imagen" : "Close image"}
            >
              <X size={22} />
            </button>
          </div>
          <div className="instruction-toolbar">
            <button
              type="button"
              aria-pressed={zoom}
              onClick={() => setZoom(!zoom)}
            >
              {zoom ? <ZoomOut size={17} /> : <ZoomIn size={17} />}{" "}
              {zoom
                ? es
                  ? "Ajustar imagen"
                  : "Fit image"
                : es
                  ? "Ampliar"
                  : "Zoom in"}
            </button>
            <a
              href={src(active.file)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {es ? "Abrir original" : "Open original"}
              <ExternalLink size={15} />
            </a>
          </div>
          <p id={`${id}-hint`} className="instruction-hint">
            {es
              ? "Amplía y desliza para leer cada paso. Los ajustes pueden variar según el modelo y la versión del sistema."
              : "Zoom in and swipe to read each step. Settings may vary by model and system version. Illustrations and screenshots are in Spanish."}
          </p>
          <div
            className="instruction-image-scroll"
            tabIndex={0}
            role="region"
            aria-label={
              es
                ? "Imagen de la guía; puedes desplazarte al ampliar"
                : "Guide image; scroll after zooming in"
            }
          >
            <Image
              src={src(active.file)}
              alt={`${active.title[locale]}: ${active.device}. ${es ? "Pasos ilustrados; consulta también las instrucciones de texto de esta página." : "Illustrated steps in Spanish; also follow the text instructions on this page."}`}
              width={active.width}
              height={724}
              unoptimized
              loading="eager"
              className={
                zoom
                  ? "instruction-full-image is-zoomed"
                  : "instruction-full-image"
              }
            />
          </div>
        </dialog>
      )}
    </div>
  );
}
