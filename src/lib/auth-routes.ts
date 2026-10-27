import type { Locale } from "./i18n";

export const authSegments = {
  login: { es: "iniciar-sesion", en: "sign-in" },
  register: { es: "crear-cuenta", en: "sign-up" },
  forgot: { es: "recuperar-contrasena", en: "forgot-password" },
  reset: { es: "nueva-contrasena", en: "reset-password" },
} as const;
export type AuthMode = keyof typeof authSegments;
export function authPath(locale: Locale, mode: AuthMode) {
  return `/${locale}/${authSegments[mode][locale]}`;
}
export function authMode(locale: Locale, segment: string) {
  return (Object.keys(authSegments) as AuthMode[]).find(
    (key) => authSegments[key][locale] === segment,
  );
}
export function safeAccountNext(value: unknown, locale: Locale) {
  const fallback = `/${locale}/${locale === "es" ? "mis-esim" : "my-esims"}`;
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    /[\\\r\n]/.test(value)
  )
    return fallback;
  try {
    const url = new URL(value, "https://mytripsim.invalid");
    const checkout = `/${locale}/${locale === "es" ? "compra" : "checkout"}`;
    if (
      url.origin === "https://mytripsim.invalid" &&
      [`/${locale}/support`, `/${locale}/admin/tickets`].includes(url.pathname)
    ) {
      const ticket = url.searchParams.get("ticket");
      return ticket &&
        /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(ticket)
        ? `${url.pathname}?ticket=${ticket}`
        : url.pathname;
    }
    if (
      url.origin === "https://mytripsim.invalid" &&
      [
        `/${locale}/admin`,
        `/${locale}/admin/security`,
        `/${locale}/admin/operations`,
        `/${locale}/admin/refunds`,
      ].includes(url.pathname)
    )
      return url.pathname;
    if (
      url.origin === "https://mytripsim.invalid" &&
      url.pathname === `/${locale}/checkout/result`
    ) {
      const id = url.searchParams.get("order");
      return id && /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)
        ? `/${locale}/checkout/result?order=${id}`
        : fallback;
    }
    if (url.origin === "https://mytripsim.invalid" && url.pathname === checkout)
      return checkout;
    if (url.origin !== "https://mytripsim.invalid" || url.pathname !== fallback)
      return fallback;
    const id = url.searchParams.get("esim");
    return id && /^[0-9a-f-]{36}$/i.test(id)
      ? `${fallback}?esim=${id}`
      : fallback;
  } catch {
    return fallback;
  }
}
