import type { Locale } from "./i18n";

export const languageCookie = "mytripsim_language";

export function preferredLanguage(
  saved: string | null | undefined,
  acceptLanguage: string | null,
): Locale {
  if (saved === "es" || saved === "en") return saved;
  const options = (acceptLanguage ?? "")
    .slice(0, 4096)
    .split(",")
    .map((entry, index) => {
      const [tag, ...parameters] = entry.trim().toLowerCase().split(";");
      const quality = parameters
        .find((value) => value.trim().startsWith("q="))
        ?.trim()
        .slice(2);
      const weight =
        quality === undefined
          ? 1
          : /^(?:0(?:\.\d{0,3})?|1(?:\.0{0,3})?)$/.test(quality)
            ? Number(quality)
            : 0;
      return { language: tag.split("-")[0], weight, index };
    })
    .filter(
      (value) =>
        (value.language === "es" || value.language === "en") &&
        value.weight > 0,
    )
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  return options[0]?.language === "es" ? "es" : "en";
}

/** Only neutral entry URLs negotiate language. Explicit localized links are stable. */
export function languageEntryPath(
  pathname: string,
  saved: string | null | undefined,
  acceptLanguage: string | null,
): string | null {
  if (pathname !== "/" && pathname !== "/portal" && pathname !== "/portal/")
    return null;
  const locale = preferredLanguage(saved, acceptLanguage);
  return pathname === "/" ? `/${locale}` : `/portal/${locale}`;
}

export function languagePreferenceCookie(
  locale: Locale,
  secure: boolean,
): string {
  return `${languageCookie}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax${secure ? "; Secure" : ""}`;
}
