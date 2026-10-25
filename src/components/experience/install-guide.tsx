"use client";
import { faqQuestionPath } from "@/lib/faq-links";
import { useState } from "react";
import { Check, Info, QrCode, Smartphone } from "lucide-react";
import { experienceCopy } from "@/lib/experience-copy";
import { experiencePath } from "@/lib/experience-routes";
import { pathFor, type Locale } from "@/lib/i18n";
import { ActionLink, BackLink, ExperienceHeading } from "./shared";
export function InstallGuide({
  locale,
  esimId,
}: {
  locale: Locale;
  esimId?: string;
}) {
  const c = experienceCopy[locale];
  const [device, setDevice] = useState<"iphone" | "android">("iphone");
  return (
    <div className="container experience-page">
      <BackLink
        href={experiencePath(
          locale,
          "wallet",
          esimId ? { esim: esimId } : undefined,
        )}
      >
        {c.wallet}
      </BackLink>
      <ExperienceHeading
        eyebrow={c.install}
        title={c.installTitle}
        description={c.installDescription}
      />
      <div className="experience-columns">
        <div>
          <section className="experience-card before-install">
            <h2>{c.before}</h2>
            <ul>
              {c.beforeItems.map((item) => (
                <li key={item}>
                  <Check size={18} />
                  {item}
                </li>
              ))}
            </ul>
            <ActionLink href={pathFor(locale, "compatibility")}>
              {c.compatibility}
            </ActionLink>
          </section>
          <div
            className="device-tabs"
            role="group"
            aria-label={locale === "es" ? "Tipo de teléfono" : "Phone type"}
          >
            <button
              aria-pressed={device === "iphone"}
              onClick={() => setDevice("iphone")}
            >
              <Smartphone size={18} />
              iPhone
            </button>
            <button
              aria-pressed={device === "android"}
              onClick={() => setDevice("android")}
            >
              <Smartphone size={18} />
              Android
            </button>
          </div>
          <ol className="install-steps">
            {(device === "iphone" ? c.iphoneSteps : c.androidSteps).map(
              (step, index) => (
                <li key={`${device}-${index}`}>
                  <span>{index + 1}</span>
                  <div>
                    <h2>{step.title}</h2>
                    <p>{step.body}</p>
                  </div>
                </li>
              ),
            )}
          </ol>
          <p className="experience-note">
            <Info size={20} />
            {c.installTiming}
          </p>
          <ActionLink href={faqQuestionPath(locale, "data-roaming")}>
            {c.faq}
          </ActionLink>
        </div>
        <div className="experience-summary">
          <section className="experience-card code-card">
            <QrCode size={25} />
            <h2>
              {locale === "es"
                ? "Tu código de instalación"
                : "Your installation code"}
            </h2>
            <p>
              {locale === "es"
                ? "Abre el detalle de tu eSIM para consultar su QR y los datos de instalación manual."
                : "Open your eSIM details to view its QR code and manual installation details."}
            </p>
            <ActionLink
              href={experiencePath(
                locale,
                "wallet",
                esimId ? { esim: esimId } : undefined,
              )}
            >
              {c.wallet}
            </ActionLink>
          </section>
          <section className="experience-card">
            <h2>{c.manual}</h2>
            <p>{c.manualBody}</p>
            <ActionLink href={faqQuestionPath(locale, "install-esim")}>
              {c.faq}
            </ActionLink>
          </section>
        </div>
      </div>
    </div>
  );
}
