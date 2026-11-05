"use client";
import Image from "next/image";
import { useState, type FormEvent } from "react";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  LogOut,
  Eye,
  EyeOff,
} from "lucide-react";
import { portalHref, type PortalLocale } from "@/lib/portal/copy";
import type { BusinessWorkspace } from "@/lib/portal/business";
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
              ? "Usa tu cuenta verificada de MyTripSim. El acceso a cada empresa requiere aprobación o invitación."
              : "Use your verified MyTripSim account. Company access requires approval or an invitation."}
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
              href={`https://www.mytripsim.com/${locale}/${es ? "crear-cuenta" : "sign-up"}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {es ? "Crear cuenta" : "Create account"}
            </a>
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
  workspace,
}: {
  locale: PortalLocale;
  base: string;
  workspace: BusinessWorkspace;
}) {
  const es = locale === "es";
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      await portalPost({
        action: "apply",
        name: String(data.get("name")).trim(),
        website: String(data.get("website")).trim(),
        note: String(data.get("note")).trim(),
      });
      window.location.reload();
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
  async function accept(id: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await portalPost({ action: "accept_invitation", id });
      window.location.assign(portalHref(locale, base, "home"));
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
      <div className="bp-panel bp-form">
        <span className="bp-icon">
          <Building2 size={24} />
        </span>
        <h2>{es ? "Tu empresa en MyTripSim" : "Your company on MyTripSim"}</h2>
        {workspace.incoming.map((invitation) => (
          <section className="bp-invitation" key={invitation.id}>
            <h3>{invitation.company_name}</h3>
            <p>
              {es
                ? "Tienes una invitación para unirte al equipo."
                : "You have an invitation to join this team."}
            </p>
            <button
              type="button"
              className="bp-button"
              disabled={busy}
              onClick={() => accept(invitation.id)}
            >
              {es ? "Aceptar invitación" : "Accept invitation"}
              <ArrowRight size={17} />
            </button>
          </section>
        ))}
        {workspace.application?.status === "pending" ? (
          <div className="bp-empty">
            <CheckCircle2 size={30} />
            <h3>{es ? "Solicitud recibida" : "Application received"}</h3>
            <p>
              {es
                ? "Revisaremos el alta de tu empresa. Cuando se apruebe, podrás entrar y crear tus viajes."
                : "We will review your company application. Once approved, you can access your workspace and create trips."}
            </p>
            <button
              className="bp-button bp-button-secondary"
              type="button"
              onClick={() => window.location.reload()}
            >
              {es ? "Comprobar estado" : "Check status"}
            </button>
          </div>
        ) : workspace.application?.status === "approved" ||
          workspace.restricted ? (
          <p>
            {es
              ? "Tu acceso necesita revisión. Contacta con el propietario de la empresa o con MyTripSim."
              : "Your access needs review. Contact the company owner or MyTripSim."}
          </p>
        ) : (
          <form className="bp-form" onSubmit={submit}>
            {workspace.application?.review_note && (
              <p>{workspace.application.review_note}</p>
            )}
            <p>
              {es
                ? "Solicita el alta de tu empresa. Un administrador revisará la solicitud antes de dar acceso."
                : "Apply for a company workspace. An administrator reviews the application before granting access."}
            </p>
            <label>
              {es ? "Nombre de la empresa" : "Company name"}
              <input
                name="name"
                required
                maxLength={120}
                autoComplete="organization"
              />
            </label>
            <label>
              {es ? "Sitio web (opcional)" : "Website (optional)"}
              <input
                name="website"
                type="url"
                maxLength={300}
                placeholder="https://"
              />
            </label>
            <label>
              {es
                ? "Cuéntanos qué viajes organizas (opcional)"
                : "Tell us about your trips (optional)"}
              <textarea name="note" rows={3} maxLength={1000} />
            </label>
            <button className="bp-button" disabled={busy} type="submit">
              {es ? "Solicitar acceso" : "Request access"}
              <ArrowRight size={17} />
            </button>
          </form>
        )}
        {error && (
          <p className="bp-error" role="alert">
            {error}
          </p>
        )}
        <PortalLogout locale={locale} base={base} />
      </div>
    </AccessFrame>
  );
}
