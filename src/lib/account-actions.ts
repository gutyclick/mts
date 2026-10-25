"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { authClient } from "./supabase/auth-server";
import { authPath, safeAccountNext } from "./auth-routes";
import { isLocale } from "./i18n";

export type AuthState = { message?: string; success?: boolean };
export async function accountAction(
  _: AuthState,
  form: FormData,
): Promise<AuthState> {
  const locale = form.get("locale") === "en" ? "en" : "es";
  const es = locale === "es";
  const mode = z
    .enum(["login", "register", "forgot", "reset"])
    .safeParse(form.get("mode"));
  const invalid = {
    message: es
      ? "Revisa los campos e inténtalo de nuevo."
      : "Check the fields and try again.",
  };
  if (!mode.success) return invalid;
  const email = z
    .email()
    .max(254)
    .safeParse(String(form.get("email") ?? "").trim());
  const password = String(form.get("password") ?? "");
  if (mode.data !== "reset" && !email.success) return invalid;
  if (mode.data !== "forgot" && (!password || password.length > 128))
    return invalid;
  if (
    (mode.data === "register" || mode.data === "reset") &&
    (password.length < 10 || password !== form.get("confirmPassword"))
  )
    return {
      message: es
        ? "Usa al menos 10 caracteres y confirma la misma contraseña."
        : "Use at least 10 characters and confirm the same password.",
    };
  const client = await authClient();
  const origin = process.env.AUTH_SITE_URL || "https://www.mytripsim.com";
  let success = false;
  try {
    if (mode.data === "login") {
      const { error } = await client.auth.signInWithPassword({
        email: email.data!,
        password,
      });
      if (error)
        return {
          message: es
            ? "No pudimos iniciar sesión. Revisa tu correo y contraseña y confirma tu correo antes de entrar."
            : "We couldn’t sign you in. Check your email and password, and confirm your email before signing in.",
        };
      success = true;
    } else if (mode.data === "register") {
      const { error } = await client.auth.signUp({
        email: email.data!,
        password,
        options: {
          data: { locale },
          emailRedirectTo: `${origin}/${locale}/auth/confirm?flow=signup`,
        },
      });
      if (error && error.code !== "user_already_exists")
        return {
          message: es
            ? "No pudimos enviar la confirmación. Inténtalo más tarde o solicita recuperar tu contraseña si ya tienes cuenta."
            : "We couldn’t send the confirmation. Try later, or request a password reset if you already have an account.",
        };
      return {
        success: true,
        message: es
          ? "Revisa tu correo para confirmar la cuenta. Si ya tienes una, puedes iniciar sesión o recuperar tu contraseña."
          : "Check your email to confirm your account. If you already have one, you can sign in or reset your password.",
      };
    } else if (mode.data === "forgot") {
      const { error } = await client.auth.resetPasswordForEmail(email.data!, {
        redirectTo: `${origin}/${locale}/auth/confirm?flow=recovery`,
      });
      if (error && error.status && error.status >= 500)
        return {
          message: es
            ? "El servicio de correo no está disponible. Inténtalo más tarde."
            : "The email service is unavailable. Try again later.",
        };
      if (error?.status === 429)
        return {
          message: es
            ? "Espera unos minutos antes de solicitar otro enlace."
            : "Wait a few minutes before requesting another link.",
        };
      if (error)
        return {
          message: es
            ? "No pudimos procesar la solicitud. Inténtalo más tarde."
            : "We couldn’t process the request. Please try later.",
        };
      return {
        success: true,
        message: es
          ? "Si existe una cuenta con ese correo, recibirás un enlace para recuperar tu contraseña."
          : "If an account exists for that email, you’ll receive a password reset link.",
      };
    } else {
      const {
        data: { user },
        error: identityError,
      } = await client.auth.getUser();
      if (!user || identityError)
        return {
          message: es
            ? "El enlace ya no es válido. Solicita uno nuevo."
            : "This link is no longer valid. Request a new one.",
        };
      const { error } = await client.auth.updateUser({ password });
      if (error)
        return {
          message: es
            ? "No se pudo cambiar la contraseña. Usa una distinta a la anterior o solicita un enlace nuevo."
            : "We couldn’t change the password. Use a different password or request a new link.",
        };
      success = true;
    }
  } catch {
    return {
      message: es
        ? "No pudimos conectar con tu cuenta. Inténtalo de nuevo."
        : "We couldn’t connect to your account. Try again.",
    };
  }
  if (success) redirect(safeAccountNext(form.get("next"), locale));
  return invalid;
}

export async function signOut(form: FormData) {
  const raw = form.get("locale");
  const locale = typeof raw === "string" && isLocale(raw) ? raw : "es";
  const client = await authClient();
  const { error } = await client.auth.signOut({ scope: "local" });
  if (error) throw new Error("Sign out failed; please retry");
  redirect(authPath(locale, "login"));
}
