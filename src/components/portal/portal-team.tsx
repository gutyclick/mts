"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Mail,
  MessageCircle,
  ShieldCheck,
  Users,
  Copy,
  UserMinus,
} from "lucide-react";
import { usePortal } from "./portal-state";
import { PageHeading, type PortalProps } from "./portal-ui";
import { roleLabel, businessMessage } from "./portal-business-copy";
import { canManageMembers } from "@/lib/portal/business";
import { portalHref } from "@/lib/portal/copy";
import { PortalLogout } from "./portal-access";

function CompanySelector({ locale, base }: PortalProps) {
  const { workspace, company, mutate } = usePortal();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  if (workspace.companies.length < 2) return null;
  return (
    <div>
      <select
        className="bp-company-select"
        aria-label={locale === "es" ? "Cambiar empresa" : "Switch company"}
        value={company.id}
        disabled={busy}
        onChange={async (event) => {
          const id = event.target.value;
          setBusy(true);
          setError("");
          try {
            await mutate({ action: "select_company", companyId: id });
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
        }}
      >
        {workspace.companies.map((value) => (
          <option key={value.id} value={value.id}>
            {value.name}
          </option>
        ))}
      </select>
      {error && (
        <p className="bp-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export function PortalTeam({ locale, base }: PortalProps) {
  const es = locale === "es";
  const { workspace, company, mutate } = usePortal();
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [success, setSuccess] = useState("");
  const owner = canManageMembers(company.role);
  async function action(body: unknown, message: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await mutate(body);
      setSuccess(message);
      router.refresh();
    } catch (value) {
      setError(
        businessMessage(
          value instanceof Error ? value.message : "unavailable",
          locale,
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void action(
      {
        action: "invite",
        companyId: company.id,
        email: String(data.get("email")).trim(),
        role: String(data.get("role")),
      },
      es
        ? "Invitación registrada. Comparte el enlace del portal con esa persona; no se ha enviado un correo automático."
        : "Invitation recorded. Share the portal link with the recipient; no automatic email has been sent.",
    );
  }
  return (
    <>
      <PageHeading
        title={es ? "Tu equipo" : "Your team"}
        description={`${company.name} · ${roleLabel(company.role, locale)}`}
      >
        <CompanySelector locale={locale} base={base} />
      </PageHeading>
      {workspace.incoming.map((invitation) => (
        <section className="bp-panel" key={invitation.id}>
          <h2>{invitation.company_name}</h2>
          <p>
            {es
              ? "Tienes una invitación para esta empresa."
              : "You have an invitation to this company."}
          </p>
          <button
            type="button"
            className="bp-button"
            disabled={busy}
            onClick={() =>
              action(
                { action: "accept_invitation", id: invitation.id },
                es
                  ? "Invitación aceptada. Puedes elegir la empresa en el menú."
                  : "Invitation accepted. Select the company in the menu.",
              )
            }
          >
            {es ? "Aceptar invitación" : "Accept invitation"}
          </button>
        </section>
      ))}
      {owner ? (
        <div className="bp-form-grid">
          <section className="bp-panel">
            <h2>{es ? "Miembros con acceso" : "Members with access"}</h2>
            <div className="bp-table-wrap">
              <table className="bp-table">
                <thead>
                  <tr>
                    <th scope="col">{es ? "Correo" : "Email"}</th>
                    <th scope="col">{es ? "Rol" : "Role"}</th>
                    <th scope="col">{es ? "Acceso" : "Access"}</th>
                  </tr>
                </thead>
                <tbody>
                  {workspace.members.map((member) => (
                    <tr key={member.user_id}>
                      <td>{member.email}</td>
                      <td>{roleLabel(member.role, locale)}</td>
                      <td>
                        {member.role !== "owner" ? (
                          <button
                            className="bp-text-link"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (
                                window.confirm(
                                  es
                                    ? `¿Quitar el acceso de ${member.email}?`
                                    : `Remove access for ${member.email}?`,
                                )
                              )
                                void action(
                                  {
                                    action: "remove_member",
                                    companyId: company.id,
                                    id: member.user_id,
                                  },
                                  es ? "Acceso retirado." : "Access removed.",
                                );
                            }}
                          >
                            <UserMinus size={15} />
                            {es ? "Quitar" : "Remove"}
                          </button>
                        ) : (
                          <ShieldCheck
                            size={17}
                            aria-label={roleLabel(member.role, locale)}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {workspace.invitations.length > 0 && (
              <>
                <h3>
                  {es ? "Invitaciones pendientes" : "Pending invitations"}
                </h3>
                <ul className="bp-invite-list">
                  {workspace.invitations.map((invitation) => (
                    <li key={invitation.id}>
                      <div>
                        <strong>{invitation.email}</strong>
                        <small>
                          {roleLabel(invitation.role, locale)} ·{" "}
                          {es ? "Vence" : "Expires"}{" "}
                          {new Date(invitation.expires_at).toLocaleDateString(
                            locale,
                          )}
                        </small>
                      </div>
                      <button
                        className="bp-text-link"
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          action(
                            {
                              action: "revoke_invitation",
                              companyId: company.id,
                              id: invitation.id,
                            },
                            es ? "Invitación revocada." : "Invitation revoked.",
                          )
                        }
                      >
                        {es ? "Revocar" : "Revoke"}
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
          <form className="bp-panel bp-form" onSubmit={invite}>
            <span className="bp-icon">
              <Users size={23} />
            </span>
            <h2>{es ? "Invita a un compañero" : "Invite a teammate"}</h2>
            <p>
              {es
                ? "Solo podrá aceptar con una cuenta verificada que use exactamente ese correo. La invitación vence en 7 días."
                : "Only a verified account with this exact email can accept. Invitations expire after 7 days."}
            </p>
            <label>
              {es ? "Correo electrónico" : "Email"}
              <input type="email" required maxLength={254} name="email" />
            </label>
            <label>
              {es ? "Rol" : "Role"}
              <select name="role">
                <option value="coordinator">
                  {roleLabel("coordinator", locale)}
                </option>
                <option value="finance">{roleLabel("finance", locale)}</option>
              </select>
            </label>
            <button type="submit" className="bp-button" disabled={busy}>
              {es ? "Crear invitación" : "Create invitation"}
            </button>
            <button
              className="bp-button bp-button-secondary"
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    `https://portal.mytripsim.com${portalHref(locale, "", "access")}`,
                  );
                  setSuccess(es ? "Enlace copiado." : "Link copied.");
                } catch {
                  setError(
                    es
                      ? "Comparte portal.mytripsim.com con tu compañero."
                      : "Share portal.mytripsim.com with your teammate.",
                  );
                }
              }}
            >
              <Copy size={16} />
              {es ? "Copiar enlace del portal" : "Copy portal link"}
            </button>
          </form>
        </div>
      ) : (
        <section className="bp-panel">
          <span className="bp-icon">
            <ShieldCheck size={23} />
          </span>
          <h2>{roleLabel(company.role, locale)}</h2>
          <p>
            {es
              ? "El propietario de tu empresa gestiona los miembros y sus permisos."
              : "Your company owner manages members and their permissions."}
          </p>
        </section>
      )}
      {error && (
        <p role="alert" className="bp-error">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="bp-success">
          {success}
        </p>
      )}
      <a className="bp-text-link" href={portalHref(locale, base, "billing")}>
        {es ? "Ver facturación" : "View billing"}
      </a>
      <PortalLogout locale={locale} base={base} />
    </>
  );
}
export function PortalSupport({ locale }: PortalProps) {
  const es = locale === "es";
  const { support } = usePortal();
  return (
    <>
      <PageHeading
        title={es ? "Estamos contigo en cada viaje" : "Here for every trip"}
        description={
          es
            ? "Canal privado de atención para tu empresa. No envíes QR ni datos de tarjeta."
            : "Private support for your company. Never send QR codes or card details."
        }
      />
      <section className="bp-panel bp-form">
        <span className="bp-icon bp-icon-orange">
          <MessageCircle size={24} />
        </span>
        {support ? (
          <>
            <h2>
              {es
                ? "Habla con tu contacto de empresas"
                : "Talk to your business contact"}
            </h2>
            <div className="bp-detail-actions">
              <a
                className="bp-button"
                target="_blank"
                rel="noopener noreferrer"
                href={`https://wa.me/${support.whatsapp.slice(1)}?text=${encodeURIComponent(es ? "Hola, necesito ayuda con el portal de empresas MyTripSim." : "Hello, I need help with the MyTripSim business portal.")}`}
              >
                <MessageCircle size={18} />
                WhatsApp
              </a>
              <a
                className="bp-button bp-button-secondary"
                href={`mailto:${support.email}`}
              >
                <Mail size={18} />
                {support.email}
              </a>
            </div>
          </>
        ) : (
          <p>
            {es
              ? "Estamos preparando tu canal privado de atención empresarial."
              : "Your private business support channel is being prepared."}
          </p>
        )}
      </section>
    </>
  );
}
