"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";
import Link from "next/link";
import type { CuratedCatalog } from "@/lib/catalog-curation";
import { OperationsShell } from "./operations-shell";
import type { Locale } from "@/lib/i18n";
type Plan = {
  id: string;
  name: string;
  days: number;
  data_gb: number;
  catalog_plan_merchandising: Record<string, unknown> | null;
};
const modes = ["standard", "premium", "iij", "usip", "nonhkip", "myip"];
export function CatalogAdmin({ locale }: { locale: Locale }) {
  const es = locale === "es";
  const [destinations, setDestinations] = useState<
    { slug: string; name: Record<string, string> }[]
  >([]);
  const [slug, setSlug] = useState("");
  const [plans, setPlans] = useState<Plan[]>([]);
  const [approved, setApproved] = useState<string[]>(["standard"]);
  const [evidence, setEvidence] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const [loadedSlug, setLoadedSlug] = useState("");
  const [preview, setPreview] = useState<CuratedCatalog | null>(null);
  const currentSlug = useRef(slug);
  useEffect(() => {
    let active = true;
    fetch("/api/admin/catalog")
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        if (active) setDestinations(d.destinations);
      })
      .catch(() => {
        if (active)
          setStatus(
            es ? "No se pudo cargar el catálogo." : "Catalog unavailable.",
          );
      });
    return () => {
      active = false;
    };
  }, [es]);
  useEffect(() => {
    if (!slug) return;
    let active = true;

    fetch(`/api/admin/catalog?destination=${encodeURIComponent(slug)}`)
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d) => {
        if (active) {
          setLoadedSlug(slug);
          setPlans(d.plans);
          setPreview(d.preview);
          setApproved(d.destination?.approved_modalities ?? ["standard"]);
          setEvidence(d.destination?.approval_evidence ?? "");
        }
      })
      .catch(() => {
        if (active) setStatus(es ? "No se pudo cargar." : "Unable to load.");
      });
    return () => {
      active = false;
    };
  }, [slug, es, revision]);
  async function save(entity: string, value: unknown) {
    const savedSlug = slug;
    setBusy(true);
    setStatus("");
    try {
      const r = await fetch("/api/admin/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entity, value }),
      });
      if (!r.ok) throw Error();
      if (currentSlug.current === savedSlug) {
        setStatus(es ? "Configuración guardada." : "Configuration saved.");
        setLoadedSlug("");
        setPlans([]);
        setPreview(null);
        setRevision((v) => v + 1);
      }
    } catch {
      setStatus(
        es
          ? "No se pudo guardar. Verifica tu sesión MFA y los campos."
          : "Unable to save. Check MFA session and fields.",
      );
    } finally {
      setBusy(false);
    }
  }
  function savePlan(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    void save("plan", {
      plan_id: id,
      visibility: f.get("visibility"),
      commercial_category: f.get("category") || null,
      recommendation_eligible: f.has("recommend"),
      incident_block: f.has("block"),
      main_priority: f.get("priority") ? Number(f.get("priority")) : null,
    });
  }
  return (
    <OperationsShell locale={locale}>
      <main className="admin-main catalog-admin">
        <h1>{es ? "Catálogo comercial" : "Commercial catalog"}</h1>
        <p>
          {es
            ? "La configuración se conserva al sincronizar. No modifica precios ni SKUs. Mostrar no evita los controles técnicos ni el límite de cuatro planes."
            : "Configuration survives sync. Prices and SKUs stay unchanged. Show respects technical checks and the four-plan limit."}
        </p>
        <label>
          {es ? "Destino" : "Destination"}{" "}
          <select
            value={slug}
            onChange={(e) => {
              currentSlug.current = e.target.value;
              setPreview(null);
              setPlans([]);
              setStatus("");
              setSlug(e.target.value);
            }}
          >
            <option value="">—</option>
            {destinations.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name[locale] ?? d.slug}
              </option>
            ))}
          </select>
        </label>
        <p role="status">{status}</p>
        {slug && (
          <Link
            className="catalog-preview-link"
            href={`/${locale}/esim/${slug}`}
            target="_blank"
          >
            {es ? "Abrir destino ↗" : "Open destination ↗"}
          </Link>
        )}
        {preview && (
          <section className="catalog-preview">
            <h2>
              {es
                ? "Selección actual publicada"
                : "Current published selection"}
            </h2>
            {preview.modes.length === 0 ? (
              <p>
                {es
                  ? "Ningún plan cumple los controles actuales."
                  : "No plans pass the current checks."}
              </p>
            ) : (
              preview.modes.map((mode) => (
                <div key={mode.id}>
                  <h3>{mode.label[locale]}</h3>
                  <div className="catalog-preview-grid">
                    {mode.plans.map((item) => (
                      <article key={item.plan.id}>
                        <span className="catalog-badge selected">
                          {item.category}
                        </span>
                        <strong>
                          {item.plan.dataGb} GB · {item.plan.days}{" "}
                          {es ? "días" : "days"}
                        </strong>
                        <code>{item.plan.id}</code>
                        <small>
                          {item.reasons
                            .map((reason) => reasonLabel(reason, es))
                            .join(" · ")}
                        </small>
                      </article>
                    ))}
                  </div>
                </div>
              ))
            )}
          </section>
        )}
        {slug && loadedSlug === slug && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save("destination", {
                destination_slug: slug,
                approved_modalities: approved,
                approval_evidence: evidence,
              });
            }}
          >
            <h2>
              {es
                ? "Modalidades verificadas (máximo 3)"
                : "Verified modalities (maximum 3)"}
            </h2>
            <p>
              {es
                ? "La aprobación requiere evidencia técnica; no implica mayor cobertura."
                : "Approval requires technical evidence; it does not imply superior coverage."}
            </p>
            {modes.map((mode) => (
              <label key={mode} className="catalog-mode-option">
                <input
                  type="checkbox"
                  checked={approved.includes(mode)}
                  onChange={(e) =>
                    setApproved(
                      e.target.checked
                        ? [...approved, mode]
                        : approved.filter((m) => m !== mode),
                    )
                  }
                />
                {mode}
              </label>
            ))}
            <p>
              <label>
                {es ? "Evidencia y fuente" : "Evidence and source"}
                <textarea
                  required
                  minLength={10}
                  maxLength={2000}
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                />
              </label>
            </p>
            <button
              disabled={busy || approved.length < 1 || approved.length > 3}
            >
              {es ? "Guardar modalidades" : "Save modalities"}
            </button>
          </form>
        )}
        {plans.map((p) => {
          const m = p.catalog_plan_merchandising;
          return (
            <form
              key={`${slug}:${p.id}:${revision}:${JSON.stringify(m)}`}
              onSubmit={(e) => savePlan(e, p.id)}
              className="catalog-plan-card"
            >
              <div className="catalog-card-heading">
                <h2>{p.name}</h2>
                <span
                  className={`catalog-badge ${m?.incident_block ? "blocked" : m?.visibility === "hide" ? "hidden" : preview?.decisions.find((d) => d.planId === p.id)?.selected ? "selected" : "auto"}`}
                >
                  {m?.incident_block
                    ? es
                      ? "Bloqueado"
                      : "Blocked"
                    : m?.visibility === "hide"
                      ? es
                        ? "Oculto"
                        : "Hidden"
                      : preview?.decisions.find((d) => d.planId === p.id)
                            ?.selected
                        ? es
                          ? "Seleccionado"
                          : "Selected"
                        : "Auto"}
                </span>
              </div>
              <p className="catalog-decision">
                {reasonLabel(
                  preview?.decisions.find((d) => d.planId === p.id)?.reason ??
                    "not_selected",
                  es,
                )}
              </p>
              <p>
                {p.id} · {p.data_gb} GB · {p.days} {es ? "días" : "days"}
              </p>
              <label>
                {es ? "Visibilidad" : "Visibility"}{" "}
                <select
                  name="visibility"
                  defaultValue={String(m?.visibility ?? "auto")}
                >
                  <option value="auto">Auto</option>
                  <option value="show">{es ? "Mostrar" : "Show"}</option>
                  <option value="hide">{es ? "Ocultar" : "Hide"}</option>
                </select>
              </label>{" "}
              <label>
                {es ? "Categoría" : "Category"}{" "}
                <select
                  name="category"
                  defaultValue={String(m?.commercial_category ?? "")}
                >
                  <option value="">Auto</option>
                  {["basic", "essential", "plus", "max"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>{" "}
              <label>
                {es ? "Prioridad (1 primero)" : "Priority (1 first)"}{" "}
                <input
                  name="priority"
                  type="number"
                  min={1}
                  max={100}
                  defaultValue={
                    m?.main_priority == null ? "" : Number(m.main_priority)
                  }
                />
              </label>
              <p>
                <label>
                  <input
                    type="checkbox"
                    name="recommend"
                    defaultChecked={m?.recommendation_eligible !== false}
                  />
                  {es
                    ? "Elegible para recomendación"
                    : "Recommendation eligible"}
                </label>{" "}
                <label>
                  <input
                    type="checkbox"
                    name="block"
                    defaultChecked={m?.incident_block === true}
                  />
                  {es ? "Bloqueo por incidencia" : "Incident block"}
                </label>
              </p>
              <button disabled={busy}>
                {es ? "Guardar plan" : "Save plan"}
              </button>
            </form>
          );
        })}
      </main>
    </OperationsShell>
  );
}

function reasonLabel(reason: string, es: boolean) {
  const labels: Record<string, [string, string]> = {
    manual_block: [
      "Oculto o bloqueado manualmente",
      "Manually hidden or blocked",
    ],
    not_fixed: [
      "Modalidad fuera del catálogo principal",
      "Package type outside primary catalog",
    ],
    missing_retail_price: [
      "Precio de venta no disponible",
      "Retail price unavailable",
    ],
    technical_identity_missing: [
      "Faltan detalles técnicos verificados",
      "Verified technical details missing",
    ],
    destination_mismatch: [
      "Cobertura no coincide con el destino",
      "Coverage does not match destination",
    ],
    network_unknown: ["Operadores sin verificar", "Operators unverified"],
    secondary_long_stay: [
      "Opción secundaria de larga estancia",
      "Secondary long-stay option",
    ],
    secondary_small_allowance: [
      "Opción secundaria de pocos datos",
      "Secondary small-data option",
    ],
    not_selected: [
      "Fuera de la selección principal",
      "Outside primary selection",
    ],
    manual_priority: [
      "Prioridad comercial manual",
      "Manual commercial priority",
    ],
    closest_category_reference: [
      "Mejor ajuste para la categoría",
      "Closest category match",
    ],
    verified_destination_and_network: [
      "Destino y operadores verificados",
      "Destination and operators verified",
    ],
    existing_retail_price: [
      "Precio vigente conservado",
      "Existing retail price retained",
    ],
    unpublished: ["SKU no publicado", "Unpublished SKU"],
    provider_unavailable: [
      "Proveedor no disponible o identidad desactualizada",
      "Provider unavailable or stale identity",
    ],
  };
  return labels[reason]?.[es ? 0 : 1] ?? reason;
}
