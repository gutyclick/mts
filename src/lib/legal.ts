import content from "@/content/legal.json";
import type { Locale } from "./i18n";

export { legalVersion, legalDate } from "./legal-version";
export const legalKeys = ["terms", "privacy", "refunds", "cookies"] as const;
export type LegalKey = (typeof legalKeys)[number];
export const isLegalKey = (key: string): key is LegalKey =>
  legalKeys.some((value) => value === key);
export const legalIdentity = {
  name: "YellowCat Enterprises LLC",
  address: "1209 Mountain Road Pl NE, Albuquerque, NM 87110, United States",
  email: "hello@mytripsim.com",
};
export type LegalBlock =
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };
export type LegalDocument = {
  title: string;
  sections: { id: string; title: string; blocks: LegalBlock[] }[];
};
export function legalDocument(locale: Locale, key: LegalKey): LegalDocument {
  return content[locale][key] as LegalDocument;
}
export const legalDescriptions = {
  es: {
    terms:
      "Las condiciones de tu compra, desde elegir el plan hasta utilizar tu eSIM y solicitar ayuda.",
    privacy:
      "Qué datos tratamos, para qué los utilizamos y cómo puedes ejercer tus derechos.",
    refunds:
      "Cómo solicitar asistencia, cancelar una compra o pedir la revisión de un reembolso.",
    cookies:
      "La información que guarda tu navegador para la cuenta, el carrito, los pagos y el soporte.",
  },
  en: {
    terms:
      "Your purchase conditions, from choosing a plan to using your eSIM and getting help.",
    privacy:
      "What information we process, why we use it and how to exercise your rights.",
    refunds:
      "How to get assistance, cancel a purchase or request a refund review.",
    cookies:
      "What your browser stores for your account, cart, payments and support.",
  },
};
