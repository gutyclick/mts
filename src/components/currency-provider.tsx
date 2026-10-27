"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  currencyCode,
  convertUsdMinor,
  formatMoney,
  paymentCartTotal,
  usdRate,
  shouldFetchCurrencyQuote,
  type Currency,
} from "@/lib/currency";
type Quote = {
  currency: Currency;
  id: string | null;
  rate: string;
  sampledAt: string | null;
  expiresAt: string | null;
};
const usd: Quote = {
  currency: "USD",
  id: null,
  rate: usdRate,
  sampledAt: null,
  expiresAt: null,
};
const storageKey = "mytripsim.currency.v1";
let memory: Currency = "USD";
function snapshot() {
  try {
    return currencyCode(localStorage.getItem(storageKey)) ?? memory;
  } catch {
    return memory;
  }
}
function subscribe(notify: () => void) {
  const storage = (e: StorageEvent) => {
    if (!e.key || e.key === storageKey) notify();
  };
  window.addEventListener("storage", storage);
  window.addEventListener("mts:currency", notify);
  return () => {
    window.removeEventListener("storage", storage);
    window.removeEventListener("mts:currency", notify);
  };
}
function write(currency: Currency) {
  memory = currency;
  try {
    localStorage.setItem(storageKey, currency);
  } catch {
    /* The preference still works for this visit. */
  }
  window.dispatchEvent(new Event("mts:currency"));
}
async function fetchQuote(
  currency: Currency,
  signal?: AbortSignal,
): Promise<Quote> {
  if (currency === "USD") return usd;
  const r = await fetch("/api/regional/pricing?currency=" + currency, {
    cache: "no-store",
    signal,
  });
  if (!r.ok) throw Error("Currency unavailable");
  const value = await r.json();
  if (
    value.currency !== currency ||
    typeof value.id !== "string" ||
    !/^[a-f0-9-]{36}$/i.test(value.id) ||
    !/^\d{1,16}$/.test(value.rate) ||
    typeof value.expiresAt !== "string" ||
    !Number.isFinite(new Date(value.expiresAt).getTime()) ||
    new Date(value.expiresAt).getTime() <= Date.now()
  )
    throw Error("Invalid quote");
  convertUsdMinor(100, currency, value.rate);
  return value;
}
type Value = {
  currency: Currency;
  ready: boolean;
  quote: Quote | null;
  busy: Currency | null;
  error: boolean;
  paymentBusy: boolean;
  setPaymentBusy: (value: boolean) => void;
  select: (currency: Currency) => Promise<boolean>;
  format: (cents: number, locale: "es" | "en") => string;
  total: (items: { unit: number; quantity: number }[]) => number | null;
};
const Context = createContext<Value>({
  currency: "USD",
  paymentBusy: false,
  setPaymentBusy: () => {},
  ready: true,
  quote: usd,
  busy: null,
  error: false,
  select: async () => false,
  format: (n, l) => formatMoney(n, "USD", l),
  total: (items) => items.reduce((sum, i) => sum + i.unit * i.quantity, 0),
});
export function useCurrency() {
  return useContext(Context);
}
export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [paymentBusy, setPaymentBusy] = useState(false);
  const currency = useSyncExternalStore(
      subscribe,
      snapshot,
      () => "USD" as const,
    ),
    [response, setResponse] = useState<{
      currency: Currency;
      quote: Quote | null;
      error: boolean;
    } | null>(null),
    [busy, setBusy] = useState<Currency | null>(null);
  const quote =
    currency === "USD"
      ? usd
      : response?.currency === currency
        ? response.quote
        : null;
  useEffect(() => {
    if (!shouldFetchCurrencyQuote(currency,response)) return;
    const abort = new AbortController();
    fetchQuote(currency, abort.signal)
      .then((quote) => setResponse({ currency, quote, error: false }))
      .catch(() => {
        if (!abort.signal.aborted)
          setResponse({ currency, quote: null, error: true });
      });
    return () => abort.abort();
  }, [currency,response]);
  async function select(next: Currency) {
    if (busy || paymentBusy) return false;
    setBusy(next);
    try {
      const quote = await fetchQuote(next);
      setResponse({ currency: next, quote, error: false });
      write(next);
      return true;
    } catch {
      setResponse((old) => ({
        currency: old?.currency ?? currency,
        quote: old?.quote ?? null,
        error: true,
      }));
      return false;
    } finally {
      setBusy(null);
    }
  }
  const value: Value = {
    currency,
    paymentBusy,
    setPaymentBusy,
    ready: !!quote,
    quote,
    busy,
    error: response?.error === true,
    select,
    format: (cents, locale) => {
      try {
        return quote
          ? formatMoney(
              convertUsdMinor(cents, currency, quote.rate),
              currency,
              locale,
            )
          : "—";
      } catch {
        return "—";
      }
    },
    total: (items) => {
      try {
        return quote ? paymentCartTotal(items, currency, quote.rate) : null;
      } catch {
        return null;
      }
    },
  };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
