"use client";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, KeyRound, LoaderCircle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { adminMfaAction } from "@/lib/admin/security-actions";
import type { Locale } from "@/lib/i18n";
export function AdminSecurity({
  locale,
  factorId,
}: {
  locale: Locale;
  factorId: string | null;
}) {
  const es = locale === "es",
    [state, action, pending] = useActionState(adminMfaAction, {}),
    router = useRouter();
  useEffect(() => {
    if (state.success) {
      router.replace(`/${locale}/admin`);
      router.refresh();
    }
  }, [state.success, locale, router]);
  const id = state.factorId ?? factorId;
  return (
    <section className="admin-security container">
      <div className="admin-security-card">
        <span className="operations-icon">
          <ShieldCheck size={28} />
        </span>
        <p className="eyebrow">
          MYTRIPSIM · {es ? "ACCESO PRIVADO" : "PRIVATE ACCESS"}
        </p>
        <h1>
          {id
            ? es
              ? "Verifica que eres tú"
              : "Verify it’s you"
            : es
              ? "Protege tu administración"
              : "Protect your administration"}
        </h1>
        <p>
          {es
            ? "La administración requiere un código de tu aplicación de autenticación además de tu contraseña."
            : "Administration requires a code from your authenticator app as well as your password."}
        </p>
        {state.qr && (
          <div className="admin-mfa-qr">
            <p>
              {es
                ? "Escanea este QR con tu autenticador. Guárdalo únicamente en tu aplicación y no lo compartas."
                : "Scan this QR with your authenticator. Keep it only in your app and do not share it."}
            </p>
            {/* Authenticator QR is a private data URL, never routed through an image proxy. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={state.qr}
              alt={
                es
                  ? "QR para configurar tu autenticador"
                  : "QR to set up your authenticator"
              }
              width={220}
              height={220}
            />
          </div>
        )}
        <form action={action}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="action" value={id ? "verify" : "enroll"} />
          {id && (
            <>
              <input type="hidden" name="factorId" value={id} />
              <label>
                <KeyRound size={17} />
                {es ? "Código de seis dígitos" : "Six-digit code"}
                <input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  minLength={6}
                  maxLength={6}
                  required
                  placeholder="000000"
                  disabled={pending}
                />
              </label>
            </>
          )}
          {state.error && (
            <p className="support-error" role="alert">
              {state.error}
            </p>
          )}
          <button className="button button-primary" disabled={pending}>
            {pending ? <LoaderCircle size={18} /> : <ArrowRight size={18} />}{" "}
            {id
              ? es
                ? "Verificar y entrar"
                : "Verify and enter"
              : es
                ? "Configurar autenticador"
                : "Set up authenticator"}
          </button>
        </form>
        {!factorId && id && !state.qr && (
          <form action={action}>
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="action" value="enroll" />
            <button className="button button-secondary" disabled={pending}>
              {es
                ? "Volver a configurar el autenticador"
                : "Set up authenticator again"}
            </button>
          </form>
        )}
        <p className="commerce-muted">
          {es
            ? "Los códigos se introducen solo aquí. Nunca los envíes por correo ni al chat de soporte."
            : "Enter codes only here. Never send them by email or in support chat."}
        </p>
        <Link href={`/${locale}/${es ? "mis-esim" : "my-esims"}`}>
          {es ? "Volver a mi cuenta" : "Back to my account"}
        </Link>
      </div>
    </section>
  );
}
