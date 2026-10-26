export function supportEmail(p: {
  locale: "es" | "en";
  reference: string;
  subject: string;
  link: string;
  customer: boolean;
}) {
  const es = p.locale === "es",
    title = p.customer
      ? es
        ? "Tienes una respuesta de MyTripSim"
        : "MyTripSim has replied"
      : es
        ? "Un viajero necesita ayuda"
        : "A traveler needs help";
  const escape = (v: string) =>
    v.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c]!,
    );
  const intro = es
    ? "Consulta la conversación y responde desde el ticket para mantener todo el historial."
    : "Read the conversation and reply from the ticket to keep the complete history.";
  const button = es ? "Abrir ticket seguro" : "Open secure ticket";
  return {
    subject: `${title} · ${p.reference}`,
    text: `MyTripSim\n${title}\n${p.reference} · ${p.subject}\n\n${intro}\n${p.link}\n\n${es ? "Se requiere iniciar sesión. No envíes contraseñas ni códigos de instalación." : "Sign-in required. Never send passwords or installation codes."}`,
    html: `<!doctype html><html lang="${p.locale}"><body style="margin:0;background:#edf5ff;font-family:Arial,sans-serif;color:#14243d"><table role="presentation" width="100%"><tr><td align="center" style="padding:32px 12px"><table role="presentation" style="max-width:560px;width:100%;background:#fff;border:1px solid #d8e7fa;border-radius:24px"><tr><td style="padding:32px"><p style="font-size:25px;font-weight:bold">MyTrip<span style="color:#1269ed">Sim</span><span style="color:#ff873c">.</span></p><p style="color:#b14f17;font-weight:bold">${escape(p.reference)}</p><h1 style="font-size:26px">${title}</h1><p style="font-size:18px">${escape(p.subject)}</p><p style="line-height:1.6">${intro}</p><p style="padding:16px 0"><a href="${escape(p.link)}" style="background:#1269ed;color:white;text-decoration:none;padding:15px 20px;border-radius:14px;font-weight:bold">${button}</a></p><p style="font-size:13px;color:#526785">${es ? "Se requiere iniciar sesión. No envíes contraseñas ni códigos de instalación." : "Sign-in required. Never send passwords or installation codes."}</p></td></tr></table></td></tr></table></body></html>`,
  };
}
