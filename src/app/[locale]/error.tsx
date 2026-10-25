"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { RefreshCw } from "lucide-react";

export default function CatalogError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { locale } = useParams();
  const es = locale === "es";
  return (
    <section className="container page-heading" role="alert">
      <p className="eyebrow">MyTripSim</p>
      <h1>
        {es ? "No pudimos cargar esta página" : "We couldn’t load this page"}
      </h1>
      <p>
        {es
          ? "Inténtalo de nuevo en unos momentos. Si necesitas orientación, puedes consultar nuestras preguntas frecuentes."
          : "Try again in a moment. For guidance, you can visit our frequently asked questions."}
      </p>
      <div className="catalog-error-actions">
        <button className="button button-primary" onClick={reset}>
          <RefreshCw size={18} aria-hidden="true" />
          {es ? "Intentar de nuevo" : "Try again"}
        </button>
        <Link
          className="button button-secondary"
          href={es ? "/es/preguntas-frecuentes" : "/en/faq"}
        >
          {es ? "Ver preguntas frecuentes" : "View frequently asked questions"}
        </Link>
      </div>
    </section>
  );
}
