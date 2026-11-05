"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Mail, MessageCircle, ShieldCheck, UserMinus } from "lucide-react";
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
    [error, setError] = useState("");
  const owner = canManageMembers(company.role);
  async function remove(id: string, email: string) {
    if (
      busy ||
      !window.confirm(
        es ? `¿Quitar el acceso de ${email}?` : `Remove access for ${email}?`,
      )
    )
      return;
    setBusy(true);
    try {
      await mutate({ action: "remove_member", companyId: company.id, id });
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
  return (
    <>
      <PageHeading
        title={es ? "Tu equipo" : "Your team"}
        description={`${company.name} · ${roleLabel(company.role, locale)}`}
      >
        <CompanySelector locale={locale} base={base} />
      </PageHeading>
      <section className="bp-panel">
        <p>
          {es
            ? "Solo el administrador de MyTripSim puede crear empresas y habilitar nuevos accesos empresariales."
            : "Only the MyTripSim administrator can create companies and enable new business access."}
        </p>
        {owner && (
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
                      {member.role === "owner" ? (
                        <ShieldCheck size={17} />
                      ) : (
                        <button
                          className="bp-text-link"
                          disabled={busy}
                          type="button"
                          onClick={() => remove(member.user_id, member.email)}
                        >
                          <UserMinus size={15} />
                          {es ? "Quitar" : "Remove"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {error && (
        <p role="alert" className="bp-error">
          {error}
        </p>
      )}
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
