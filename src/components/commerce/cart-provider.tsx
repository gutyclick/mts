"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from "lucide-react";
import {
  CART_STORAGE_KEY,
  addCartLine,
  cartKey,
  readCart,
  type CartLine,
  type ResolvedCart,
} from "@/lib/cart";
import { experiencePath } from "@/lib/experience-routes";
import { pathFor, type Locale } from "@/lib/i18n";
import { DestinationFlag } from "../destination-flag";

const empty: CartLine[] = [];
let memory = empty;
let cachedRaw: string | null = null;
let cachedLines = empty;
let storageBlocked = false;
function snapshot() {
  if (storageBlocked) return memory;
  let raw: string;
  try {
    raw = localStorage.getItem(CART_STORAGE_KEY) ?? "[]";
  } catch {
    return memory;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedLines = readCart(raw);
  }
  return cachedLines;
}
function subscribe(notify: () => void) {
  const storage = (event: StorageEvent) => {
    if (!event.key || event.key === CART_STORAGE_KEY) notify();
  };
  window.addEventListener("storage", storage);
  window.addEventListener("mytripsim:cart", notify);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener("mytripsim:cart", notify);
  };
}
function write(lines: CartLine[]) {
  memory = lines;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  } catch {
    storageBlocked = true;
  }
  window.dispatchEvent(new Event("mytripsim:cart"));
}
type CartContextValue = {
  lines: CartLine[];
  resolved: ResolvedCart;
  loading: boolean;
  error: boolean;
  add: (line: CartLine) => void;
  ensure: (line: CartLine) => void;
  update: (line: CartLine, quantity: number) => void;
  open: () => void;
  close: () => void;
  retry: () => void;
};
const Context = createContext<CartContextValue | null>(null);
export function useCart() {
  const value = useContext(Context);
  if (!value) throw new Error("Cart provider is required");
  return value;
}
export function CartProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const es = locale === "es";
  const lines = useSyncExternalStore(subscribe, snapshot, () => empty);
  // Quantities do not affect catalog identity; keep controls mounted when they change.
  const key = JSON.stringify(lines.map((line) => ({ ...line, quantity: 1 })));
  const [attempt, setAttempt] = useState(0);
  const [response, setResponse] = useState<{
    key: string;
    result: ResolvedCart;
    error: boolean;
  }>();
  const [isOpen, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (key === "[]") return;
    const controller = new AbortController();
    fetch("/api/cart/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: key,
      signal: controller.signal,
    })
      .then(async (r) => {
        if (!r.ok) throw new Error("Cart unavailable");
        return (await r.json()) as ResolvedCart;
      })
      .then((result) => setResponse({ key, result, error: false }))
      .catch(() => {
        if (!controller.signal.aborted)
          setResponse({
            key,
            result: { items: [], unavailable: [] },
            error: true,
          });
      });
    return () => controller.abort();
  }, [key, attempt]);
  useEffect(() => {
    const element = dialog.current;
    if (isOpen && element && !element.open) element.showModal();
    if (!isOpen && element?.open) element.close();
    if (!isOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isOpen]);
  const loading = lines.length > 0 && response?.key !== key;
  const catalog =
    lines.length && response?.key === key
      ? response.result
      : { items: [], unavailable: [] };
  const resolved = {
    items: catalog.items.map((item) => ({
      ...item,
      quantity: lines.find((line) => cartKey(line) === cartKey(item))!.quantity,
    })),
    unavailable: catalog.unavailable.map((item) => ({
      ...item,
      quantity: lines.find((line) => cartKey(line) === cartKey(item))!.quantity,
    })),
  };
  const error = lines.length > 0 && response?.key === key && response.error;
  const value: CartContextValue = {
    lines,
    resolved,
    loading,
    error: !!error,
    ensure(line) {
      const current = snapshot();
      if (!current.some((item) => cartKey(item) === cartKey(line)))
        write(addCartLine(current, line));
    },
    add(line) {
      const before = snapshot();
      const next = addCartLine(before, line);
      write(next);
      setNotice(
        JSON.stringify(before) === JSON.stringify(next)
          ? es
            ? "Has alcanzado el límite del carrito."
            : "You have reached the cart limit."
          : es
            ? "Plan añadido al carrito"
            : "Plan added to your cart",
      );
      setOpen(true);
    },
    update(line, quantity) {
      write(
        snapshot().flatMap((item) =>
          cartKey(item) !== cartKey(line)
            ? [item]
            : quantity <= 0
              ? []
              : [{ ...item, quantity: Math.min(10, quantity) }],
        ),
      );
    },
    open: () => {
      setNotice("");
      setOpen(true);
    },
    close: () => setOpen(false),
    retry: () => {
      setResponse(undefined);
      setAttempt((a) => a + 1);
    },
  };
  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <Context.Provider value={value}>
      {children}
      <dialog
        ref={dialog}
        className="cart-drawer"
        aria-labelledby="cart-title"
        onCancel={() => setOpen(false)}
        onClose={() => setOpen(false)}
        onClick={(event) => {
          if (event.target !== event.currentTarget) return;
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            setOpen(false);
        }}
      >
        <div className="cart-drawer-heading">
          <div>
            <p className="eyebrow">MYTRIPSIM</p>
            <h2 id="cart-title">
              <ShoppingBag size={23} />
              {es ? "Tu carrito" : "Your cart"}
              <span>{count}</span>
            </h2>
          </div>
          <button
            type="button"
            className="commerce-icon"
            aria-label={es ? "Cerrar carrito" : "Close cart"}
            onClick={value.close}
          >
            <X size={21} />
          </button>
        </div>
        <p className="cart-notice" role="status">
          {notice && (
            <>
              <Check size={17} />
              {notice}
            </>
          )}
        </p>
        <div className="cart-drawer-content">
          <CartItems locale={locale} />
        </div>
        {count > 0 && !error && !loading && (
          <div className="cart-drawer-footer">
            <p>
              {es
                ? "El precio estará disponible antes de pagar."
                : "The price will be available before payment."}
            </p>
            <Link
              href={experiencePath(locale, "checkout")}
              className="button button-primary"
              onClick={value.close}
            >
              {es ? "Continuar con mi compra" : "Continue to checkout"}
              <ArrowRight size={18} />
            </Link>
            <button className="commerce-link" onClick={value.close}>
              {es ? "Seguir explorando" : "Keep exploring"}
            </button>
          </div>
        )}
      </dialog>
    </Context.Provider>
  );
}
export function CartTrigger({ locale }: { locale: Locale }) {
  const cart = useCart();
  const count = cart.lines.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <button
      type="button"
      className="cart-trigger"
      aria-label={
        locale === "es"
          ? `Abrir carrito, ${count} eSIM`
          : `Open cart, ${count} eSIMs`
      }
      aria-haspopup="dialog"
      onClick={cart.open}
    >
      <ShoppingBag size={20} aria-hidden="true" />
      {count > 0 && (
        <span key={count} className="cart-count">
          {count}
        </span>
      )}
    </button>
  );
}
export function CartItems({ locale }: { locale: Locale }) {
  const cart = useCart();
  const es = locale === "es";
  if (cart.loading)
    return (
      <p className="commerce-loading" role="status">
        {es ? "Revisando tus planes…" : "Checking your plans…"}
      </p>
    );
  if (cart.error)
    return (
      <div className="commerce-empty" role="alert">
        <p>
          {es
            ? "No pudimos actualizar tus planes. Tu selección sigue guardada."
            : "We couldn’t refresh your plans. Your selection is still saved."}
        </p>
        <button className="button button-secondary" onClick={cart.retry}>
          {es ? "Reintentar" : "Try again"}
        </button>
      </div>
    );
  if (!cart.lines.length)
    return (
      <div className="commerce-empty">
        <span className="commerce-empty-icon">
          <ShoppingBag size={34} />
        </span>
        <h3>
          {es ? "Tu próximo viaje empieza aquí" : "Your next trip starts here"}
        </h3>
        <p>
          {es
            ? "Añade una eSIM y prepara tu conexión."
            : "Add an eSIM and get your connection ready."}
        </p>
        <Link
          href={pathFor(locale, "destinations")}
          className="button button-primary"
          onClick={cart.close}
        >
          {es ? "Explorar destinos" : "Explore destinations"}
          <ArrowRight size={17} />
        </Link>
      </div>
    );
  return (
    <ul className="cart-items">
      {cart.resolved.items.map((item) => (
        <li key={cartKey(item)} className="cart-item">
          <div className="cart-item-top">
            <DestinationFlag
              destination={{
                code: item.countryCode,
                type: item.regional ? "region" : "country",
              }}
            />
            <div>
              <Link
                href={`${pathFor(locale, undefined, item.destination)}?plan=${encodeURIComponent(item.planId)}`}
                onClick={cart.close}
              >
                {item.name[locale]}
              </Link>
              <p>
                {item.allowance.replace(/(\d)(GB|MB)/, "$1 $2")} <span>·</span>{" "}
                {item.days} {es ? "días" : "days"}
              </p>
              {item.network && <small>{item.network}</small>}
            </div>
            <button
              type="button"
              className="commerce-icon"
              aria-label={`${es ? "Eliminar" : "Remove"} ${item.name[locale]} ${item.dataGb} GB ${item.days} ${es ? "días" : "days"}`}
              onClick={() => cart.update(item, 0)}
            >
              <Trash2 size={17} />
            </button>
          </div>
          <div className="cart-item-bottom">
            <div
              className="cart-quantity"
              role="group"
              aria-label={`${es ? "Cantidad de" : "Quantity for"} ${item.name[locale]} ${item.dataGb} GB ${item.days} ${es ? "días" : "days"}`}
            >
              <button
                type="button"
                aria-label={es ? "Reducir cantidad" : "Decrease quantity"}
                disabled={item.quantity === 1}
                onClick={() => cart.update(item, item.quantity - 1)}
              >
                <Minus size={15} />
              </button>
              <output aria-live="polite">{item.quantity}</output>
              <button
                type="button"
                aria-label={es ? "Aumentar cantidad" : "Increase quantity"}
                disabled={item.quantity === 10}
                onClick={() => cart.update(item, item.quantity + 1)}
              >
                <Plus size={15} />
              </button>
            </div>
            <span className="cart-price-pending">
              {es ? "Precio pendiente" : "Price pending"}
            </span>
          </div>
        </li>
      ))}
      {cart.resolved.unavailable.map((item) => (
        <li key={cartKey(item)} className="cart-item cart-item-unavailable">
          <strong>
            {es
              ? "Este plan ya no está disponible"
              : "This plan is no longer available"}
          </strong>
          <button
            className="commerce-link"
            onClick={() => cart.update(item, 0)}
          >
            {es ? "Eliminar del carrito" : "Remove from cart"}
          </button>
        </li>
      ))}
    </ul>
  );
}
