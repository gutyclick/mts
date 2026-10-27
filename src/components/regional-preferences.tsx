"use client";
import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Check, Globe2, Coins, X, Search, LoaderCircle } from "lucide-react";
import { type Locale } from "@/lib/i18n";
import { regionalLanguageHref } from "@/lib/regional-preferences";
import { currencies } from "@/lib/currency";
import { useCurrency } from "./currency-provider";

type Tab = "language" | "currency";
const Context = createContext<{open:(element:HTMLElement)=>void}>({open:()=>{}});
export function RegionalTrigger({ locale }: { locale: Locale }) {
  const { open } = useContext(Context);
  const pricing = useCurrency();
  return (
    <button
      type="button"
      className="language-switch regional-trigger"
      aria-haspopup="dialog"
      disabled={pricing.paymentBusy}
      aria-label={
        locale === "es"
          ? "Elegir idioma y moneda"
          : "Choose language and currency"
      }
      onClick={(e) => open(e.currentTarget)}
    >
      <Globe2 size={17} aria-hidden="true" />
      <span>{locale.toUpperCase()}</span>
      <span className="regional-divider" aria-hidden="true">
        ·
      </span>
      <span>{pricing.currency}</span>
    </button>
  );
}
export function RegionalPreferences({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  const pricing = useCurrency();
  const [search, setSearch] = useState("");
  const es = locale === "es",
    pathname = usePathname(),
    query = useSearchParams().toString(),
    id = useId(),
    dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLElement | null>(null),
    tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const [open, setOpen] = useState(false),
    [tab, setTab] = useState<Tab>("language");
  useEffect(() => {
    if (!open) {
      dialog.current?.close();
      trigger.current?.focus();
      return;
    }
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.showModal();
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);
  const close = () => setOpen(false);
  const href = (target: Locale) =>
    regionalLanguageHref(pathname, target, query);
  const tabNames = es ? ["Idioma", "Moneda"] : ["Language", "Currency"];
  function moveTab(event: React.KeyboardEvent, index: number) {
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowLeft")
      next = 1 - index;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = 1;
    else return;
    event.preventDefault();
    setTab(next === 0 ? "language" : "currency");
    tabs.current[next]?.focus();
  }
  return (
    <Context.Provider
      value={{
        open: (element) => {
          trigger.current = element;
          setTab("language");
          setSearch("");
          setOpen(true);
        },
      }}
    >
      {children}
      <dialog
        ref={dialog}
        className="regional-dialog"
        aria-labelledby={`${id}-title`}
        onCancel={close}
        onClose={close}
        onClick={(e) => {
          if (e.target !== e.currentTarget) return;
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close();
        }}
      >
        <div className="regional-top">
          <h2 id={`${id}-title`}>
            {es ? "Idioma y moneda" : "Language and currency"}
          </h2>
          <button
            className="regional-close"
            type="button"
            aria-label={es ? "Cerrar preferencias" : "Close preferences"}
            onClick={close}
          >
            <X size={21} />
          </button>
        </div>
        <div
          className="regional-tabs"
          role="tablist"
          aria-label={es ? "Preferencias de viaje" : "Travel preferences"}
        >
          {(["language", "currency"] as const).map((value, index) => {
            const Icon = index === 0 ? Globe2 : Coins;
            return (
              <button
                key={value}
                ref={(element) => {
                  tabs.current[index] = element;
                }}
                id={`${id}-${value}-tab`}
                role="tab"
                type="button"
                tabIndex={tab === value ? 0 : -1}
                aria-selected={tab === value}
                aria-controls={`${id}-${value}-panel`}
                onClick={() => setTab(value)}
                onKeyDown={(event) => moveTab(event, index)}
              >
                <Icon size={20} aria-hidden="true" />
                {tabNames[index]}
              </button>
            );
          })}
        </div>
        <section
          className="regional-panel"
          id={`${id}-language-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-language-tab`}
          hidden={tab !== "language"}
        >
          <div className="regional-options">
            {(
              [
                {
                  code: "es",
                  native: "Español",
                  description: es ? "Español" : "Spanish",
                },
                {
                  code: "en",
                  native: "English",
                  description: es ? "Inglés" : "English",
                },
              ] as const
            ).map((option) => (
              <a
                key={option.code}
                href={href(option.code)}
                hrefLang={option.code}
                lang={option.code}
                className={`regional-option${option.code === locale ? " is-selected" : ""}`}
                aria-current={option.code === locale ? "true" : undefined}
                onClick={(e) => {
                  if (option.code === locale) {
                    e.preventDefault();
                    close();
                    return;
                  }
                  e.currentTarget.href = regionalLanguageHref(
                    pathname,
                    option.code,
                    window.location.search,
                    window.location.hash,
                  );
                }}
                onAuxClick={(e) => {
                  e.currentTarget.href = regionalLanguageHref(
                    pathname,
                    option.code,
                    window.location.search,
                    window.location.hash,
                  );
                }}
              >
                <span>
                  <strong>{option.native}</strong>
                  <small lang={locale}>{option.description}</small>
                </span>
                <span className="regional-check" aria-hidden="true">
                  {option.code === locale && <Check size={14} />}
                </span>
              </a>
            ))}
          </div>
        </section>
        <section
          className="regional-panel"
          id={`${id}-currency-panel`}
          role="tabpanel"
          aria-labelledby={`${id}-currency-tab`}
          hidden={tab !== "currency"}
        >
          <label className="regional-search">
            <Search size={18} aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={es ? "Buscar moneda" : "Search currencies"}
              aria-label={es ? "Buscar moneda" : "Search currencies"}
            />
          </label>
          <div
            className="regional-options currency-options"
            aria-busy={!!pricing.busy}
          >
            {currencies
              .filter((option) =>
                (option.code + " " + option[locale])
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .toLowerCase()
                  .includes(
                    search
                      .normalize("NFD")
                      .replace(/[\u0300-\u036f]/g, "")
                      .toLowerCase(),
                  ),
              )
              .map((option) => (
                <button
                  key={option.code}
                  type="button"
                  className={
                    "regional-option" +
                    (pricing.currency === option.code ? " is-selected" : "")
                  }
                  aria-pressed={pricing.currency === option.code}
                  disabled={!!pricing.busy}
                  onClick={async () => {
                    if (await pricing.select(option.code)) close();
                  }}
                >
                  <span>
                    <strong>
                      {option.code} · {option.symbol}
                    </strong>
                    <small>{option[locale]}</small>
                  </span>
                  <span className="regional-check" aria-hidden="true">
                    {pricing.busy === option.code ? (
                      <LoaderCircle size={14} className="payment-spinner" />
                    ) : pricing.currency === option.code ? (
                      <Check size={14} />
                    ) : null}
                  </span>
                </button>
              ))}
          </div>
          {pricing.busy && (
            <p className="regional-note" role="status">
              {es ? "Actualizando precios…" : "Updating prices…"}
            </p>
          )}
          {pricing.error && (
            <p className="regional-error" role="alert">
              {es
                ? "No pudimos actualizar la moneda. Inténtalo de nuevo; puedes seguir usando USD."
                : "We could not update the currency. Try again; you can continue using USD."}
            </p>
          )}
          <p className="regional-note">
            {es
              ? "Las nuevas compras usan la moneda elegida. Los pedidos ya iniciados conservan su moneda original. Sin recargo de cambio de MyTripSim; tu banco puede aplicar sus propias comisiones."
              : "New purchases use your chosen currency. Orders already started keep their original currency. No MyTripSim exchange markup; your bank may apply its own fees."}
          </p>
          {pricing.quote?.sampledAt&&<p className="regional-note">{es?'Cotización de referencia':'Reference quote'}: {new Intl.DateTimeFormat(locale,{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'}).format(new Date(pricing.quote.sampledAt))} UTC</p>}
        </section>
      </dialog>
    </Context.Provider>
  );
}
