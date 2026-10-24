import type { Locale } from "./i18n";
export const experienceSegments = {
  checkout: { en: "checkout", es: "compra" },
  wallet: { en: "my-esims", es: "mis-esim" },
  install: { en: "install", es: "instalar" },
  studio: { en: "studio", es: "estudio" },
} as const;
export type ExperienceKey = keyof typeof experienceSegments;
export function experienceKey(locale: Locale, segment: string) {
  return (Object.keys(experienceSegments) as ExperienceKey[]).find(
    (key) => experienceSegments[key][locale] === segment,
  );
}
export function experiencePath(
  locale: Locale,
  key: ExperienceKey,
  values?: Record<string, string>,
) {
  const query = values ? new URLSearchParams(values).toString() : "";
  return `/${locale}/${experienceSegments[key][locale]}${query ? `?${query}` : ""}`;
}
export function planPath(locale: Locale, slug: string, planId: string) {
  return `/${locale}/plan/${slug}/${encodeURIComponent(planId)}`;
}
