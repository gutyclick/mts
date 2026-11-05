"use client";
import Image from "next/image";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  LockKeyhole,
  Mail,
  ShieldCheck,
  LogOut,
  Eye,
  EyeOff,
} from "lucide-react";
import { portalHref, type PortalLocale } from "@/lib/portal/copy";
import { businessMessage } from "./portal-business-copy";

export async function portalPost(body: unknown, auth = false) {
  const response = await fetch(auth ? "/api/portal/auth" : "/api/portal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const value = await response.json();
  if (!response.ok) throw Error(value.error ?? "unavailable");
  return value;
}
function AccessFrame({
  locale,
  children,
}: {
  locale: PortalLocale;
  children: React.ReactNode;
}) {
  return (
    <div className="bp-app bp-access-shell" lang={locale}>
      <header>
        <a href={`https://www.mytripsim.com/${locale}`}>
          <Image
            src="/logomytripsim.png"
            width={1667}
            height={417}
            alt="MyTripSim"
            sizes="160px"
          />
        </a>
        <span>BUSINESS</span>
      </header>
      <main>
        <div className="bp-access-intro">
          <span className="bp-eyebrow">MYTRIPSIM BUSINESS</span>
          <h1>
            {locale === "es"
              ? "Tu grupo. Tu viaje. Todo conectado."
              : "Your group. Your trip. All connected."}
          </h1>
          <p>
            {locale === "es"
              ? "Un espacio privado para organizar los viajes de tu empresa y solicitar las eSIM del grupo."
              : "A private workspace to organize company trips and request eSIMs for your group."}
          </p>
          <Image
            src="/images/sim/sim_traveler.png"
            width={230}
            height={230}
            alt="SIM"
            priority
            sizes="(max-width:760px) 110px, 230px"
          />
        </div>
        <div className="bp-access-content">{children}</div>
      </main>
      <footer className="bp-access-legal">
        <a
          href={`https://www.mytripsim.com/${locale}/${locale === "es" ? "privacidad" : "privacy"}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {locale === "es" ? "Privacidad" : "Privacy"}
        </a>
        <span>YellowCat Enterprises LLC · MyTripSim</span>
      </footer>
    </div>
  );
}
export function PortalLogout({
  locale,
  base,
}: {
  locale: PortalLocale;
  base: string;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function logout() {
    setBusy(true);
    try {
      await portalPost({ action: "logout" }, true);
      window.location.assign(portalHref(locale, base, "access"));
    } catch {
      setError(businessMessage("unavailable", locale));
      setBusy(false);
    }
  }
  return (
    <>
      <button
        type="button"
        className="bp-logout"
        disabled={busy}
        onClick={logout}
      >
        <LogOut size={17} />
        {locale === "es" ? "Cerrar sesión" : "Sign out"}
      </button>
      {error && (
        <p role="alert" className="bp-error">
          {error}
        </p>
      )}
    </>
  );
}
export function PortalAccess({
  locale,
  base,
  mfa = false,
}: {
  locale: PortalLocale;
  base: string;
  mfa?: boolean;
}) {
  const es = locale === "es";
  const [needsMfa, setNeedsMfa] = useState(mfa),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [visible, setVisible] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await portalPost(
        needsMfa
          ? { action: "mfa", code: String(data.get("code")) }
          : {
              action: "login",
              email: String(data.get("email")).trim(),
              password: String(data.get("password")),
            },
        true,
      );
      if (result.mfaRequired) {
        setNeedsMfa(true);
        setBusy(false);
      } else window.location.assign(portalHref(locale, base, "home"));
    } catch (value) {
      setError(
        businessMessage(
          value instanceof Error ? value.message : "unavailable",
          locale,
        ),
      );
      setBusy(false);
    }
  }
  return (
    <AccessFrame locale={locale}>
      <form className="bp-panel bp-form" onSubmit={submit}>
        <span className="bp-icon">
          <ShieldCheck size={23} />
        </span>
        <h2>
          {needsMfa
            ? es
              ? "Verifica tu acceso"
              : "Verify your access"
            : es
              ? "Accede a tu empresa"
              : "Access your company"}
        </h2>
        <p>
          {needsMfa
            ? es
              ? "Introduce el código de tu autenticador."
              : "Enter the code from your authenticator."
            : es
              ? "Usa tu cuenta verificada de MyTripSim. El administrador debe habilitar tu acceso empresarial."
              : "Use your verified MyTripSim account. Your administrator must enable business access."}
        </p>
        {needsMfa ? (
          <label>
            {es ? "Código de autenticación" : "Authentication code"}
            <input
              name="code"
              required
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              autoComplete="one-time-code"
            />
          </label>
        ) : (
          <>
            <label>
              {es ? "Correo electrónico" : "Email"}
              <span className="bp-input-icon">
                <Mail size={18} />
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="username"
                  maxLength={254}
                />
              </span>
            </label>
            <label>
              {es ? "Contraseña" : "Password"}
              <span className="bp-input-icon">
                <LockKeyhole size={18} />
                <input
                  name="password"
                  type={visible ? "text" : "password"}
                  required
                  maxLength={128}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setVisible(!visible)}
                  aria-label={
                    es
                      ? visible
                        ? "Ocultar contraseña"
                        : "Mostrar contraseña"
                      : visible
                        ? "Hide password"
                        : "Show password"
                  }
                >
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
          </>
        )}
        {error && (
          <p className="bp-error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="bp-button" disabled={busy}>
          {busy
            ? es
              ? "Verificando…"
              : "Verifying…"
            : es
              ? "Continuar"
              : "Continue"}
          <ArrowRight size={17} />
        </button>
        {!needsMfa && (
          <div className="bp-auth-links">
            <a
              href={`https://www.mytripsim.com/${locale}/${es ? "recuperar-contrasena" : "forgot-password"}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {es ? "Recuperar contraseña" : "Reset password"}
            </a>
          </div>
        )}
        {needsMfa && <PortalLogout locale={locale} base={base} />}
      </form>
    </AccessFrame>
  );
}
export function PortalApplication({
  locale,
  base,
}: {
  locale: PortalLocale;
  base: string;
}) {
  const es = locale === "es";
  return (
    <AccessFrame locale={locale}>
      <div className="bp-panel bp-form">
        <span className="bp-icon">
          <ShieldCheck size={24} />
        </span>
        <h2>
          {es ? "Acceso por administración" : "Administrator-managed access"}
        </h2>
        <p>
          {es
            ? "Las cuentas empresariales son creadas y habilitadas exclusivamente por el administrador de MyTripSim. Tu cuenta todavía no tiene acceso a una empresa activa."
            : "Business accounts are created and enabled exclusively by the MyTripSim administrator. Your account does not currently have access to an active company."}
        </p>
        <button
          className="bp-button bp-button-secondary"
          type="button"
          onClick={() => window.location.reload()}
        >
          {es ? "Comprobar acceso" : "Check access"}
        </button>
        <PortalLogout locale={locale} base={base} />
      </div>
    </AccessFrame>
  );
}
