"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  UserRound,
} from "lucide-react";
import { accountAction } from "@/lib/account-actions";
import { authPath, type AuthMode } from "@/lib/auth-routes";
import type { Locale } from "@/lib/i18n";

export function AuthForm({
  locale,
  mode,
  next,
}: {
  locale: Locale;
  mode: AuthMode;
  next: string;
}) {
  const es = locale === "es";
  const [state, action, pending] = useActionState(accountAction, {});
  const [visible, setVisible] = useState(false);
  const credentials = mode === "register" || mode === "reset";
  const labels = {
    login: es ? "Iniciar sesión" : "Sign in",
    register: es ? "Crear mi cuenta" : "Create my account",
    forgot: es ? "Enviar enlace" : "Send reset link",
    reset: es ? "Guardar contraseña" : "Save password",
  };
  return (
    <form action={action} className="account-form">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="next" value={next} />
      {mode === "register" && (
        <div className="account-name-fields">
          <label htmlFor="account-first-name">
            {es ? "Nombre" : "First name"}
            <span className="account-input">
              <UserRound size={18} aria-hidden="true" />
              <input
                id="account-first-name"
                name="firstName"
                type="text"
                autoComplete="given-name"
                required
                maxLength={100}
              />
            </span>
          </label>
          <label htmlFor="account-last-name">
            {es ? "Apellido" : "Last name"}
            <span className="account-input">
              <UserRound size={18} aria-hidden="true" />
              <input
                id="account-last-name"
                name="lastName"
                type="text"
                autoComplete="family-name"
                required
                maxLength={100}
              />
            </span>
          </label>
        </div>
      )}
      {mode !== "reset" && (
        <label htmlFor="account-email">
          {es ? "Correo electrónico" : "Email address"}
          <span className="account-input">
            <Mail size={18} aria-hidden="true" />
            <input
              id="account-email"
              type="email"
              name="email"
              autoComplete="email"
              inputMode="email"
              required
              maxLength={254}
              placeholder="tu@correo.com"
            />
          </span>
        </label>
      )}
      {mode !== "forgot" && (
        <>
          <label htmlFor="account-password">
            {mode === "reset"
              ? es
                ? "Nueva contraseña"
                : "New password"
              : es
                ? "Contraseña"
                : "Password"}
            <span className="account-input">
              <LockKeyhole size={18} aria-hidden="true" />
              <input
                id="account-password"
                type={visible ? "text" : "password"}
                name="password"
                autoComplete={credentials ? "new-password" : "current-password"}
                required
                minLength={credentials ? 10 : undefined}
                maxLength={128}
                aria-describedby={credentials ? "password-hint" : undefined}
              />
              <button
                type="button"
                onClick={() => setVisible(!visible)}
                aria-label={
                  visible
                    ? es
                      ? "Ocultar contraseña"
                      : "Hide password"
                    : es
                      ? "Mostrar contraseña"
                      : "Show password"
                }
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          {credentials && (
            <>
              <p id="password-hint" className="account-hint">
                {es
                  ? "Al menos 10 caracteres. Puedes usar una frase larga y única."
                  : "At least 10 characters. You can use a long, unique passphrase."}
              </p>
              <label htmlFor="account-confirm">
                {es ? "Confirmar contraseña" : "Confirm password"}
                <span className="account-input">
                  <LockKeyhole size={18} aria-hidden="true" />
                  <input
                    id="account-confirm"
                    type={visible ? "text" : "password"}
                    name="confirmPassword"
                    autoComplete="new-password"
                    required
                    minLength={10}
                    maxLength={128}
                  />
                </span>
              </label>
            </>
          )}
        </>
      )}
      {state.message && (
        <p
          className={`account-message ${state.success ? "is-success" : ""}`}
          role={state.success ? "status" : "alert"}
        >
          {state.message}
        </p>
      )}
      <button
        type="submit"
        className="button button-primary account-submit"
        disabled={pending || (!!state.success && mode === "register")}
      >
        {pending ? (
          <LoaderCircle size={18} className="account-spinner" />
        ) : (
          <ArrowRight size={18} aria-hidden="true" />
        )}
        {pending ? (es ? "Un momento…" : "Please wait…") : labels[mode]}
      </button>
      {mode === "login" && (
        <Link href={authPath(locale, "forgot")}>
          {es ? "¿Olvidaste tu contraseña?" : "Forgot your password?"}
        </Link>
      )}
      {mode === "register" && (
        <p className="account-hint">
          {es
            ? "Tu correo se utiliza para acceder a tu cuenta y gestionar tus eSIM."
            : "Your email is used to access your account and manage your eSIMs."}
        </p>
      )}
      <p className="account-switch">
        {mode === "login"
          ? es
            ? "¿Primera vez por aquí?"
            : "New here?"
          : es
            ? "¿Ya tienes una cuenta?"
            : "Already have an account?"}{" "}
        <Link
          href={`${authPath(locale, mode === "login" ? "register" : "login")}?next=${encodeURIComponent(next)}`}
        >
          {mode === "login"
            ? es
              ? "Crea tu cuenta"
              : "Create your account"
            : es
              ? "Inicia sesión"
              : "Sign in"}
        </Link>
      </p>
    </form>
  );
}
