import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { SimMascot } from "../sim-mascot";
import { AuthForm } from "./auth-form";
import { authClient } from "@/lib/supabase/auth-server";
import { authPath, safeAccountNext, type AuthMode } from "@/lib/auth-routes";
import { pathFor, type Locale } from "@/lib/i18n";

export async function AuthPage({
  locale,
  mode,
  next,
  error,
}: {
  locale: Locale;
  mode: AuthMode;
  next: unknown;
  error?: string;
}) {
  const es = locale === "es";
  const target = safeAccountNext(next, locale);
  const client = await authClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (user && (mode === "login" || mode === "register") && !error)
    redirect(target);
  const titles = {
    login: es
      ? "Tu próxima aventura empieza aquí."
      : "Your next adventure starts here.",
    register: es
      ? "Un lugar para todos tus viajes."
      : "One place for all your trips.",
    forgot: es ? "Volvamos a tu cuenta." : "Let’s get you back in.",
    reset: es
      ? "Una nueva contraseña. Todo listo."
      : "A new password. Ready to go.",
  };
  const descriptions = {
    login: es
      ? "Accede a tus pedidos, tus eSIM y las instrucciones de instalación."
      : "Access your orders, eSIMs and installation instructions.",
    register: es
      ? "Crea tu cuenta para tener tus eSIM a mano, estés donde estés."
      : "Create an account to keep your eSIMs close, wherever you go.",
    forgot: es
      ? "Te enviaremos un enlace para que elijas una nueva contraseña."
      : "We’ll send you a link to choose a new password.",
    reset: es
      ? "Elige una contraseña única para proteger tu cuenta."
      : "Choose a unique password to protect your account.",
  };
  return (
    <div className="container account-auth-page">
      <section className="account-welcome">
        <p className="eyebrow">
          MYTRIPSIM / {es ? "TU CUENTA" : "YOUR ACCOUNT"}
        </p>
        <h1>{titles[mode]}</h1>
        <p>{descriptions[mode]}</p>
        <SimMascot
          variant={mode === "forgot" ? "help" : "traveler"}
          locale={locale}
          sizes="(max-width: 700px) 140px, 300px"
          className="account-mascot"
        />
        <span className="account-privacy">
          <ShieldCheck size={20} />
          {es
            ? "Tus viajes, en tu espacio privado."
            : "Your trips, in your private space."}
        </span>
      </section>
      <section
        className="account-auth-card"
        aria-label={es ? "Acceso a tu cuenta" : "Account access"}
      >
        <h2>
          {mode === "login"
            ? es
              ? "Qué bueno verte de nuevo"
              : "Good to see you again"
            : mode === "register"
              ? es
                ? "Crea tu cuenta"
                : "Create your account"
              : mode === "forgot"
                ? es
                  ? "Recupera tu contraseña"
                  : "Reset your password"
                : es
                  ? "Actualiza tu contraseña"
                  : "Update your password"}
        </h2>
        {error && (
          <p className="account-message" role="alert">
            {es
              ? "El enlace no es válido o ya fue utilizado. Solicita uno nuevo."
              : "The link is invalid or has already been used. Request a new one."}{" "}
            <Link href={authPath(locale, "forgot")}>
              {es ? "Recuperar acceso" : "Recover access"}
            </Link>
          </p>
        )}
        {mode === "reset" && !user ? (
          <p className="account-message">
            {es
              ? "Abre el enlace de recuperación de tu correo para continuar."
              : "Open the password reset link in your email to continue."}{" "}
            <Link href={authPath(locale, "forgot")}>
              {es ? "Solicitar un enlace" : "Request a link"}
            </Link>
          </p>
        ) : (
          <AuthForm locale={locale} mode={mode} next={target} />
        )}
        <Link className="account-back" href={pathFor(locale)}>
          <ArrowLeft size={16} />
          {es ? "Volver a explorar" : "Back to exploring"}
        </Link>
      </section>
    </div>
  );
}
