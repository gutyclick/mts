import { equivalentPath, type Locale } from "./i18n.ts";
export function regionalLanguageHref(
  path: string,
  locale: Locale,
  search = "",
  hash = "",
) {
  return (
    equivalentPath(path, locale) +
    (search ? "?" + search.replace(/^\?/, "") : "") +
    (hash ? "#" + hash.replace(/^#/, "") : "")
  );
}
