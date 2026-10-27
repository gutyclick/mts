import type { Locale } from "../i18n.ts";
import { breadcrumbSchema, localizedMetadata, siteUrl } from "../seo.ts";

const copy = {
  es: {
    title: "SimCoins: recompensas eSIM para tus viajes",
    description:
      "Descubre los niveles de SimCoins y cómo funcionan las recompensas por compras eSIM: acumulación, saldo y condiciones de canje para tu próxima aventura.",
    home: "Inicio",
  },
  en: {
    title: "SimCoins: eSIM rewards for your next trip",
    description:
      "Explore SimCoins levels, learn how eSIM purchase rewards work and check when coins become available, plus the conditions for using them on your next purchase.",
    home: "Home",
  },
};

export function simcoinsMetadata(locale: Locale) {
  return localizedMetadata(
    locale,
    copy[locale].title,
    copy[locale].description,
    { es: "/es/simcoins", en: "/en/simcoins" },
  );
}

export function simcoinsPageSchema(locale: Locale) {
  const url = `${siteUrl}/${locale}/simcoins`;
  const breadcrumb = {
    ...breadcrumbSchema([
      { name: copy[locale].home, path: `/${locale}` },
      { name: "SimCoins", path: `/${locale}/simcoins` },
    ]),
    "@id": `${url}#breadcrumb`,
  };
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: copy[locale].title,
        description: copy[locale].description,
        inLanguage: locale,
        isPartOf: { "@id": `${siteUrl}/#website` },
        publisher: { "@id": `${siteUrl}/#organization` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      breadcrumb,
    ],
  };
}
