"use server";
import { z } from "zod";
import { authClient } from "../supabase/auth-server";
import { adminSession } from "./server";
import { authenticatorQr } from "./authenticator-qr";
export type MfaState = {
  factorId?: string;
  qr?: string;
  success?: boolean;
  error?: string;
};
export async function adminMfaAction(
  _: MfaState,
  form: FormData,
): Promise<MfaState> {
  const es = form.get("locale") !== "en",
    enrolling = form.get("action") === "enroll",
    fail: MfaState = {
      error: enrolling
        ? es
          ? "No pudimos preparar el autenticador. Vuelve a intentarlo o recarga la página."
          : "We couldn’t prepare the authenticator. Try again or reload the page."
        : es
          ? "No pudimos verificar el acceso. Comprueba el código y la hora de tu autenticador e inténtalo de nuevo."
          : "We couldn’t verify access. Check the code and your authenticator’s clock and try again.",
    };
  try {
    const session = await adminSession();
    if (!session.user || !session.member) return fail;
    const client = await authClient(),
      { data: factors, error: factorError } =
        await client.auth.mfa.listFactors();
    if (factorError) return fail;
    const action = z.enum(["enroll", "verify"]).parse(form.get("action"));
    if (action === "enroll") {
      if (factors.totp.some((f) => f.status === "verified")) return fail;
      for (const f of factors.all.filter(
        (f) =>
          f.factor_type === "totp" &&
          f.status === "unverified" &&
          f.friendly_name === "MyTripSim Admin",
      )) {
        const { error } = await client.auth.mfa.unenroll({ factorId: f.id });
        if (error) return fail;
      }
      const { data, error } = await client.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "MyTripSim Admin",
        issuer: "MyTripSim",
      });
      if (error) return fail;
      return {
        factorId: data.id,
        qr: authenticatorQr(data.totp.qr_code),
      };
    }
    const factorId = z.uuid().parse(form.get("factorId"));
    if (!factors.all.some((f) => f.id === factorId && f.factor_type === "totp"))
      return fail;
    // Keep the server-verified factor on an invalid code so enrollment can be retried.
    fail.factorId = factorId;
    const code = z
      .string()
      .regex(/^\d{6}$/)
      .parse(form.get("code"));
    const { error } = await client.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (error) return fail;
    return { success: true };
  } catch {
    return fail;
  }
}
