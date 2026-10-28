"use client";
import { useEffect } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { browserStatsBlocked } from "@/lib/analytics/client";
import {
  adsConsent,
  googleAdsId,
  googleAdsPage,
} from "@/lib/analytics/google-ads";
type TagWindow = Window & {
  dataLayer?: unknown[];
  gtag?: (...args: unknown[]) => void;
  mtsAdsInitialized?: boolean;
};
export function GoogleAdsTag({ consent }: { consent: boolean }) {
  const path = usePathname();
  const publicPage = googleAdsPage(path);
  const allowed = consent && publicPage && !browserStatsBlocked();
  useEffect(() => {
    const w = window as TagWindow;
    if (!publicPage) {
      w.gtag?.("consent", "update", adsConsent(false));
      return;
    }
    w.dataLayer ??= [];
    w.gtag ??= function () {
      // Google's gtag queue uses the official arguments-object command format.
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    };
    if (!w.mtsAdsInitialized) {
      w.gtag("consent", "default", adsConsent(false));
      w.gtag("set", "ads_data_redaction", true);
      w.gtag("js", new Date());
      w.mtsAdsInitialized = true;
    }
    w.gtag("consent", "update", adsConsent(allowed));
    w.gtag("config", googleAdsId, {
      send_page_view: false,
      allow_ad_personalization_signals: false,
      allow_enhanced_conversions: false,
      page_location: window.location.origin + path,
      page_referrer: "",
      page_title: "MyTripSim",
    });
    return () => {
      w.gtag?.("consent", "update", adsConsent(false));
    };
  }, [allowed, path, publicPage]);
  return publicPage ? (
    <Script
      id="mts-google-ads"
      src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`}
      strategy="afterInteractive"
    />
  ) : null;
}
