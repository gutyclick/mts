import { Smartphone, Apple } from "lucide-react";
import { installationLinks } from "@/lib/esim-installation";
import type { Locale } from "@/lib/i18n";

export function QuickInstall({
  smdp,
  code,
  locale,
}: {
  smdp: string;
  code: string;
  locale: Locale;
}) {
  const links = installationLinks(smdp, code);
  if (!links) return null;
  const es = locale === "es";
  return (
    <div className="quick-install">
      <h3>
        {es
          ? "Instalación directa, sin escanear"
          : "Install directly, without scanning"}
      </h3>
      <p>
        {es
          ? "Abre esta página en el teléfono donde usarás tu eSIM y elige tu sistema."
          : "Open this page on the phone that will use this eSIM and choose your system."}
      </p>
      <div className="quick-install-actions">
        <a
          className="button button-primary"
          href={links.ios}
          rel="noreferrer"
          referrerPolicy="no-referrer"
        >
          <Apple size={19} />
          {es ? "Instalar en iPhone" : "Install on iPhone"}
        </a>
        <a
          className="button button-secondary"
          href={links.android}
          rel="noreferrer"
          referrerPolicy="no-referrer"
        >
          <Smartphone size={19} />
          {es ? "Instalar en Android" : "Install on Android"}
        </a>
      </div>
      <p className="account-hint">
        {es
          ? "iPhone: iOS 17.4 o posterior. Android: depende del modelo y navegador; prueba con Chrome. Si no se abre el instalador, utiliza el QR o los datos manuales. Instalar puede iniciar la vigencia en algunos planes: revisa las condiciones antes de continuar."
          : "iPhone: iOS 17.4 or later. Android support depends on the model and browser; try Chrome. If setup does not open, use the QR or manual details. Installation may start validity on some plans: check your plan before continuing."}
      </p>
    </div>
  );
}
