import type { PortalLocale } from "@/lib/portal/copy";
export function businessMessage(code: string, locale: PortalLocale) {
  const es = locale === "es";
  return (
    (
      {
        verified_account_required: es
          ? "El correo debe corresponder a una cuenta MyTripSim existente y verificada."
          : "The email must belong to an existing verified MyTripSim account.",
        admin_only: es
          ? "Solo la administración puede crear empresas y habilitar accesos."
          : "Only administration can create companies and enable access.",
        unauthorized: es
          ? "Inicia sesión para continuar."
          : "Sign in to continue.",
        login_failed: es
          ? "No pudimos verificar el acceso. Revisa tus datos, la confirmación del correo o el código del autenticador."
          : "We could not verify access. Check your credentials, email confirmation or authenticator code.",
        mfa_required: es
          ? "Verifica el acceso con tu autenticador."
          : "Verify access with your authenticator.",
        company_required: es
          ? "Tu acceso a esta empresa cambió. Recarga la página."
          : "Your company access changed. Reload the page.",
        role_required: es
          ? "Tu rol no permite realizar esta acción."
          : "Your role does not allow this action.",
        rate_limited: es
          ? "Has realizado varios intentos. Espera unos minutos y vuelve a intentarlo."
          : "Too many attempts. Wait a few minutes and try again.",
        conflict: es
          ? "Los datos cambiaron o la solicitud ya se procesó. Recarga antes de volver a intentarlo."
          : "The data changed or the request was already processed. Reload before trying again.",
        plan_unavailable: es
          ? "El plan cambió de disponibilidad. Recarga para elegir otro."
          : "Plan availability changed. Reload to choose another.",
        plan_too_short: es
          ? "La duración del plan no cubre todas las fechas del viaje."
          : "The plan does not cover the full trip duration.",
        invalid_quantity: es
          ? "Revisa la cantidad de eSIM para el grupo."
          : "Check the eSIM quantity for this group.",
        invitation_unavailable: es
          ? "La invitación venció, fue revocada o corresponde a otro correo."
          : "The invitation expired, was revoked or belongs to another email.",
        trip_limit: es
          ? "Esta empresa alcanzó el límite inicial de 500 viajes. Contacta con el equipo."
          : "This company reached the initial 500-trip limit. Contact the team.",
        invalid: es
          ? "Revisa los campos e inténtalo de nuevo."
          : "Check the fields and try again.",
        invalid_trip: es
          ? "Revisa el destino, las fechas y el número de viajeros."
          : "Check the destination, dates and group size.",
        invalid_state: es
          ? "Esta solicitud ya cambió de estado. Recarga la página."
          : "The request status changed. Reload the page.",
      } as Record<string, string>
    )[code] ??
    (es
      ? "No pudimos completar la operación. Conservamos tus datos; vuelve a intentarlo."
      : "We could not complete the action. Your input is preserved; try again.")
  );
}
export const roleLabel = (role: string, locale: PortalLocale) =>
  ({
    owner: locale === "es" ? "Propietario" : "Owner",
    coordinator: locale === "es" ? "Coordinador" : "Coordinator",
    finance: locale === "es" ? "Finanzas" : "Finance",
  })[role] ?? role;
