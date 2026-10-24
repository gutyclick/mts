"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCheck,
  CircleHelp,
  ExternalLink,
  LockKeyhole,
  Search,
  ShieldCheck,
  Smartphone,
  X,
} from "lucide-react";
import { pathFor, type Locale } from "@/lib/i18n";
import {
  assessDevice,
  deviceBrands,
  deviceSources,
  reviewedOn,
  type Answer,
} from "@/lib/device-compatibility";

const copy = {
  es: {
    launch: "Verificar compatibilidad",
    close: "Cerrar verificador",
    back: "Atrás",
    next: "Continuar",
    result: "Ver resultado",
    done: "Volver a la ficha",
    restart: "Comprobar otro equipo",
    steps: ["Marca", "Modelo", "Tu equipo", "Resultado"],
    title: [
      "¿Qué marca viaja contigo?",
      "Encuentra tu modelo",
      "Dos detalles antes de viajar",
      "Tu comprobación de eSIM",
    ],
    intro: [
      "Vamos a comprobar tu equipo, paso a paso.",
      "Encuéntralo en Ajustes → Información.",
      "La versión de tu equipo y su operador también cuentan.",
      "Esta orientación combina documentación oficial y tus respuestas; no detecta ni prueba tu dispositivo.",
    ],
    others: "Más marcas",
    brand: "Elige la marca",
    search: "Buscar modelo",
    missing: "Mi modelo no aparece",
    empty:
      "No encontramos ese modelo. Puedes continuar con una comprobación manual.",
    official: "Soporte documentado",
    pending: "Pendiente de confirmar con el fabricante",
    candidate:
      "La lista es orientativa: algunas versiones cambian según el país y el operador.",
    region: "¿Dónde compraste el equipo?",
    regionNote: "País de compra, no destino de tu viaje.",
    regions: [
      "Selecciona una opción",
      "Reino Unido",
      "Australia",
      "España",
      "Malasia",
      "Estados Unidos",
      "Canadá",
      "Japón",
      "China continental",
      "Hong Kong / Macao",
      "Taiwán",
      "Otro país",
      "No lo sé",
    ],
    unlocked: "¿Está liberado para otros operadores?",
    unlockHelp:
      "En iPhone: Ajustes → General → Información → Bloqueo del operador. Debe indicar «Sin restricciones de SIM». En Android, confírmalo con tu operador.",
    esim: "¿Ves la opción «Añadir eSIM» en Ajustes?",
    esimHelp:
      "iPhone: Datos móviles → Añadir eSIM. Samsung: Conexiones → Administrador de SIM. Pixel: Redes e Internet → SIMs → Añadir SIM. En otras marcas, busca «eSIM» en Ajustes. Los nombres pueden variar.",
    answers: ["Sí", "No", "No lo sé"],
    privacy: "No necesitas compartir tu IMEI, EID ni número de teléfono.",
    ready: "Tu modelo tiene soporte eSIM",
    readyBody:
      "La documentación consultada indica soporte eSIM y tus respuestas cumplen las comprobaciones básicas. Verifica siempre la variante exacta y las condiciones del plan antes de comprar.",
    review: "Falta confirmar tu versión",
    reviewBody:
      "Todavía no podemos confirmar la compatibilidad de este equipo. Que no aparezca en la lista o que no veas una opción no significa automáticamente que sea incompatible. Revisa el modelo exacto y su versión regional con el fabricante.",
    locked: "Primero, libera tu equipo",
    lockedBody:
      "Has indicado que tu equipo está bloqueado por un operador. Pide a ese operador que confirme su liberación antes de intentar usar una eSIM de viaje.",
    excluded: "Esta versión tiene una excepción",
    excludedBody:
      "Google indica que los Pixel 3 comprados en Australia, Japón o Taiwán, y los Pixel 3a comprados en Japón, no admiten eSIM. Confirma el origen y modelo de tu equipo.",
    appleNote:
      "Apple: en China continental y Hong Kong / Macao hay diferencias por modelo. Para equipos comprados en China continental, las eSIM de operadores extranjeros no se pueden instalar mientras estés allí. Consulta las reglas específicas de Apple.",
    pixelNote:
      "Pixel 3: también hay restricciones en equipos de operadores de EE. UU. / Canadá. Pixel 3a: las unidades compradas con servicio de Verizon no admiten eSIM. No aplicamos una exclusión general a los Pixel de Hong Kong.",
    oneplusNote:
      "La ficha estadounidense del OnePlus 13R consultada describe dos nano-SIM y no confirma eSIM. La lista del proveedor no basta para aprobar este modelo.",
    reviewed: "Fuentes consultadas",
    source: "Consultar documentación",
    guide: "Ver guía de compatibilidad",
    help: "Resolver dudas en las FAQ",
    sourceNote:
      "La documentación acredita funciones del modelo o familia, no la compatibilidad de una unidad concreta con todos los proveedores.",
  },
  en: {
    launch: "Check compatibility",
    close: "Close checker",
    back: "Back",
    next: "Continue",
    result: "See result",
    done: "Back to the page",
    restart: "Check another device",
    steps: ["Brand", "Model", "Your device", "Result"],
    title: [
      "Which brand travels with you?",
      "Find your model",
      "Two checks before you travel",
      "Your eSIM check",
    ],
    intro: [
      "Let's check your device, one step at a time.",
      "Find the exact name in Settings → About.",
      "Your device variant and carrier matter too.",
      "This guidance combines official documentation and your answers; it does not detect or test your device.",
    ],
    others: "More brands",
    brand: "Choose a brand",
    search: "Search models",
    missing: "My model is not listed",
    empty: "We couldn't find that model. You can continue with a manual check.",
    official: "Documented support",
    pending: "Awaiting manufacturer confirmation",
    candidate:
      "This list is a guide: some variants differ by purchase country and carrier.",
    region: "Where did you buy your device?",
    regionNote: "The purchase country, not your travel destination.",
    regions: [
      "Select an option",
      "United Kingdom",
      "Australia",
      "Spain",
      "Malaysia",
      "United States",
      "Canada",
      "Japan",
      "China mainland",
      "Hong Kong / Macao",
      "Taiwan",
      "Another country",
      "I'm not sure",
    ],
    unlocked: "Is it unlocked for other carriers?",
    unlockHelp:
      "On iPhone: Settings → General → About → Carrier Lock should show “No SIM restrictions”. On Android, confirm with your carrier.",
    esim: "Can you see “Add eSIM” in Settings?",
    esimHelp:
      "iPhone: Cellular → Add eSIM. Samsung: Connections → SIM manager. Pixel: Network & internet → SIMs → Add SIM. For other brands, search Settings for “eSIM”. Labels may vary.",
    answers: ["Yes", "No", "I'm not sure"],
    privacy: "You don't need to share your IMEI, EID or phone number.",
    ready: "Your model supports eSIM",
    readyBody:
      "The documentation reviewed indicates eSIM support and your answers meet the basic checks. Always verify your exact variant and the plan's conditions before buying.",
    review: "Your variant needs confirmation",
    reviewBody:
      "We can't confirm compatibility for this device yet. A missing model or setting does not automatically mean it is incompatible. Check the exact model and regional variant with the manufacturer.",
    locked: "Unlock your device first",
    lockedBody:
      "You indicated your device is carrier locked. Ask that carrier to confirm it is unlocked before trying to use a travel eSIM.",
    excluded: "This variant has an exception",
    excludedBody:
      "Google states that Pixel 3 devices bought in Australia, Japan or Taiwan, and Pixel 3a devices bought in Japan, do not support eSIM. Confirm your device's origin and model.",
    appleNote:
      "Apple: China mainland and Hong Kong / Macao have model-specific differences. For devices bought in China mainland, foreign carrier eSIMs cannot be installed while you are there. Check Apple's specific rules.",
    pixelNote:
      "Pixel 3 also has restrictions on US / Canadian carrier devices. Pixel 3a units bought with Verizon service do not support eSIM. We do not apply a blanket exclusion to Hong Kong Pixels.",
    oneplusNote:
      "The US OnePlus 13R specification reviewed describes two nano-SIMs and does not confirm eSIM. The supplier's list alone cannot approve this model.",
    reviewed: "Sources consulted",
    source: "Read documentation",
    guide: "See compatibility guide",
    help: "Find answers in the FAQ",
    sourceNote:
      "Documentation establishes model or family features, not compatibility of a specific device with every provider.",
  },
};
const regionValues = [
  "",
  "uk",
  "au",
  "es",
  "my",
  "us",
  "ca",
  "jp",
  "cn",
  "hk",
  "tw",
  "other",
  "unknown",
];

export function CompatibilityChecker({ locale }: { locale: Locale }) {
  const c = copy[locale];
  const uid = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [brand, setBrand] = useState("");
  const [modelName, setModelName] = useState("");
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("");
  const [unlocked, setUnlocked] = useState<Answer | "">("");
  const [esim, setEsim] = useState<Answer | "">("");
  const selectedBrand = deviceBrands.find((item) => item.name === brand);
  const model = selectedBrand?.models.find((item) => item.name === modelName);
  const visibleModels =
    selectedBrand?.models.filter((item) =>
      item.name.toLowerCase().includes(search.toLowerCase()),
    ) ?? [];
  const status = assessDevice(
    brand,
    model,
    region,
    unlocked || "unknown",
    esim || "unknown",
  );
  const canContinue =
    step === 0
      ? Boolean(brand)
      : step === 1
        ? Boolean(modelName)
        : Boolean(region && unlocked && esim);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  useEffect(() => {
    if (open) {
      heading.current?.focus();
      dialog.current?.querySelector(".compat-content")?.scrollTo(0, 0);
    }
  }, [open, step]);
  const close = () => {
    dialog.current?.close();
    setOpen(false);
    trigger.current?.focus();
  };
  const reset = () => {
    setStep(0);
    setBrand("");
    setModelName("");
    setSearch("");
    setRegion("");
    setUnlocked("");
    setEsim("");
  };
  const chooseModel = (name: string) => {
    setModelName(name);
    setRegion("");
    setUnlocked("");
    setEsim("");
  };
  const chooseBrand = (name: string) => {
    setBrand(name);
    chooseModel("");
    setSearch("");
  };
  return (
    <>
      <button
        ref={trigger}
        className="compat-launch"
        onClick={() => {
          reset();
          setOpen(true);
        }}
      >
        <Smartphone size={20} />
        {c.launch}
        <ArrowRight size={16} />
      </button>
      <dialog
        ref={dialog}
        className="compat-dialog"
        aria-labelledby={`${uid}-title`}
        aria-describedby={`${uid}-intro`}
        onCancel={(event) => {
          event.preventDefault();
          close();
        }}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }}
      >
        <div className="compat-shell">
          <header className="compat-top">
            <span className="compat-wordmark">
              mytrip<span>sim</span>
              <small> / eSIM check</small>
            </span>
            <button
              className="compat-close"
              aria-label={c.close}
              onClick={close}
            >
              <X size={23} />
            </button>
          </header>
          <ol className="compat-progress" aria-label={c.launch}>
            {c.steps.map((label, index) => (
              <li
                key={label}
                aria-current={index === step ? "step" : undefined}
                data-complete={index < step}
              >
                <span>{index < step ? <Check size={14} /> : index + 1}</span>
                {label}
              </li>
            ))}
          </ol>
          <div className="compat-content">
            <h2 id={`${uid}-title`} ref={heading} tabIndex={-1}>
              {c.title[step]}
            </h2>
            <p id={`${uid}-intro`} className="compat-intro">
              {c.intro[step]}
            </p>
            {step === 0 && (
              <>
                <div className="compat-brands">
                  {deviceBrands.slice(0, 3).map((item, index) => (
                    <button
                      key={item.name}
                      aria-pressed={brand === item.name}
                      onClick={() => chooseBrand(item.name)}
                    >
                      <span className="compat-brand-symbol">
                        {["i", "S", "G"][index]}
                      </span>
                      <strong>{item.name}</strong>
                      <span className="compat-choice-dot">
                        {brand === item.name && <Check size={14} />}
                      </span>
                    </button>
                  ))}
                </div>
                <label className="compat-field" htmlFor={`${uid}-brand`}>
                  {c.others}
                </label>
                <select
                  id={`${uid}-brand`}
                  value={
                    deviceBrands.slice(3).some((item) => item.name === brand)
                      ? brand
                      : ""
                  }
                  onChange={(event) => chooseBrand(event.target.value)}
                >
                  <option value="">{c.brand}</option>
                  {deviceBrands.slice(3).map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.name === "Other brands" && locale === "es"
                        ? "Otras marcas"
                        : item.name}
                    </option>
                  ))}
                </select>
              </>
            )}
            {step === 1 && (
              <>
                <p className="compat-selected-brand">{brand}</p>
                <label className="compat-field" htmlFor={`${uid}-search`}>
                  {c.search}
                </label>
                <div className="compat-search">
                  <Search size={18} />
                  <input
                    id={`${uid}-search`}
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    autoComplete="off"
                  />
                </div>
                <div
                  className="compat-models"
                  role="group"
                  aria-label={c.steps[1]}
                >
                  {visibleModels.map((item) => (
                    <button
                      key={item.name}
                      aria-pressed={modelName === item.name}
                      onClick={() => chooseModel(item.name)}
                    >
                      <span>
                        {item.name}
                        <small>
                          {item.source && item.source !== "oneplus"
                            ? c.official
                            : c.pending}
                        </small>
                      </span>
                      <span className="compat-choice-dot">
                        {modelName === item.name && <Check size={14} />}
                      </span>
                    </button>
                  ))}
                  {!visibleModels.length && <p>{c.empty}</p>}
                </div>
                <button
                  className="compat-missing"
                  aria-pressed={modelName === "unlisted"}
                  onClick={() => chooseModel("unlisted")}
                >
                  <CircleHelp size={17} />
                  {c.missing}
                  {modelName === "unlisted" && <Check size={17} />}
                </button>
                <p className="compat-fine">{c.candidate}</p>
              </>
            )}
            {step === 2 && (
              <>
                <p className="compat-selected-brand">
                  {brand} · {model?.name ?? c.missing}
                </p>
                <label className="compat-field" htmlFor={`${uid}-region`}>
                  {c.region}
                </label>
                <select
                  id={`${uid}-region`}
                  value={region}
                  onChange={(event) => setRegion(event.target.value)}
                  aria-describedby={`${uid}-region-help`}
                >
                  {regionValues.map((value, index) => (
                    <option key={value} value={value}>
                      {c.regions[index]}
                    </option>
                  ))}
                </select>
                <p className="compat-fine" id={`${uid}-region-help`}>
                  {c.regionNote}
                </p>
                {[
                  {
                    label: c.unlocked,
                    help: c.unlockHelp,
                    value: unlocked,
                    set: setUnlocked,
                  },
                  {
                    label: c.esim,
                    help: c.esimHelp,
                    value: esim,
                    set: setEsim,
                  },
                ].map((question, index) => (
                  <fieldset className="compat-question" key={question.label}>
                    <legend>{question.label}</legend>
                    <details className="compat-check-help">
                      <summary>
                        {locale === "es" ? "Cómo comprobarlo" : "How to check"}
                      </summary>
                      <p id={`${uid}-help-${index}`}>{question.help}</p>
                    </details>
                    <div>
                      {(["yes", "no", "unknown"] as const).map((answer, i) => (
                        <label key={answer}>
                          <input
                            type="radio"
                            name={`${uid}-answer-${index}`}
                            value={answer}
                            checked={question.value === answer}
                            onChange={() => question.set(answer)}
                            aria-describedby={`${uid}-help-${index}`}
                          />
                          <span>{c.answers[i]}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
              </>
            )}
            {step === 3 && (
              <>
                <div className={`compat-result compat-result-${status}`}>
                  {status === "ready" ? (
                    <CheckCheck size={28} />
                  ) : status === "locked" ? (
                    <LockKeyhole size={28} />
                  ) : (
                    <CircleHelp size={28} />
                  )}
                  <h3>{c[status]}</h3>
                  <p>{c[`${status}Body`]}</p>
                </div>
                <p className="compat-selected-brand">
                  {brand} · {model?.name ?? c.missing}
                </p>
                {model?.source === "apple" && ["cn", "hk"].includes(region) && (
                  <p className="compat-caution">{c.appleNote}</p>
                )}
                {brand === "Google Pixel" &&
                  ["Pixel 3", "Pixel 3a"].includes(modelName) && (
                    <p className="compat-caution">{c.pixelNote}</p>
                  )}
                {model?.source === "oneplus" && (
                  <p className="compat-caution">{c.oneplusNote}</p>
                )}
                {model?.source ? (
                  <div className="compat-sources">
                    <p>
                      {c.reviewed} ·{" "}
                      <time dateTime={reviewedOn}>{reviewedOn}</time>
                    </p>
                    <a
                      href={deviceSources[model.source].url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {deviceSources[model.source].label}
                      <ExternalLink size={14} />
                    </a>
                    {model.source === "apple" &&
                      ["cn", "hk"].includes(region) && (
                        <a
                          href={deviceSources.appleChina.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {deviceSources.appleChina.label}
                          <ExternalLink size={14} />
                        </a>
                      )}
                    <small>{c.sourceNote}</small>
                  </div>
                ) : (
                  <p className="compat-caution">{c.pending}</p>
                )}
                <Link
                  className="compat-help"
                  href={`${pathFor(locale, "faq")}#faq-device-compatibility`}
                >
                  {c.help}
                  <ArrowRight size={16} />
                </Link>
              </>
            )}
          </div>
          <footer className="compat-footer">
            <p>
              <ShieldCheck size={15} />
              {c.privacy}
            </p>
            <div>
              {step > 0 && step < 3 && (
                <button
                  className="button button-secondary"
                  onClick={() => setStep(step - 1)}
                >
                  <ArrowLeft size={16} />
                  {c.back}
                </button>
              )}
              {step < 3 ? (
                <button
                  className="button button-primary"
                  disabled={!canContinue}
                  onClick={() => {
                    setStep(step + 1);
                    dialog.current?.scrollTo(0, 0);
                  }}
                >
                  {step === 2 ? c.result : c.next}
                  <ArrowRight size={17} />
                </button>
              ) : (
                <>
                  <button className="button button-secondary" onClick={reset}>
                    {c.restart}
                  </button>
                  <button className="button button-primary" onClick={close}>
                    {c.done}
                    <Check size={17} />
                  </button>
                </>
              )}
            </div>
          </footer>
        </div>
      </dialog>
    </>
  );
}
