export const googleAdsId = "AW-653792266";
export const adsPreferenceKey = "mts_google_ads_consent_v1";
export function adsPreference(
  raw: string | null,
  now = Date.now(),
): "yes" | "no" | null {
  try {
    const value = JSON.parse(raw ?? "null");
    return value &&
      (value.choice === "yes" || value.choice === "no") &&
      Number.isSafeInteger(value.expires) &&
      value.expires > now &&
      value.expires <= now + 180 * 86400000
      ? value.choice
      : null;
  } catch {
    return null;
  }
}
export function googleAdsPage(path: string) {
  return (
    /^\/(es|en)(?:\/(?:esim\/[a-z0-9-]+|destinos|destinations|como-funciona|how-it-works|compatibilidad|compatibility|preguntas-frecuentes(?:\/[a-z0-9-]+)?|faq(?:\/[a-z0-9-]+)?|simcoins))?\/?$/.test(
      path,
    ) && !/\/esim\/access\/?$/.test(path)
  );
}
export function adsConsent(granted: boolean) {
  return {
    ad_storage: granted ? "granted" : "denied",
    ad_user_data: granted ? "granted" : "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
  } as const;
}

// Runs before external tags, including when there is no saved consent choice.
export const googleAdsBootstrap = `window.dataLayer=window.dataLayer||[];window.gtag=window.gtag||function(){window.dataLayer.push(arguments);};window.gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied'});window.gtag('set','ads_data_redaction',true);window.gtag('js',new Date());window.mtsAdsInitialized=true;`;
