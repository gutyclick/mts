type EmailInput = {
  locale: "es" | "en";
  name: string;
  dataGb: number;
  days: number;
  reference: string;
  smdpAddress: string;
  activationCode: string;
  link: string;
  qrContentId: string;
};
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function deliveryEmail(p: EmailInput) {
  const es = p.locale === "es",
    title = es
      ? "Tu eSIM está lista para viajar"
      : "Your eSIM is ready to travel";
  const allowance =
    p.dataGb < 1 ? Math.round(p.dataGb * 1000) + " MB" : p.dataGb + " GB";
  const intro = es
    ? "Aquí tienes tu QR y los datos para instalar tu eSIM. Guarda este correo y no compartas tus códigos."
    : "Here are your QR code and installation details. Keep this email and do not share your codes.";
  const steps = es
    ? [
        "Conéctate a una red Wi-Fi fiable antes de instalar.",
        "En Ajustes, añade una eSIM y escanea el QR desde otra pantalla, o utiliza los datos manuales.",
        "Selecciona la eSIM para datos móviles y activa su itinerancia. Desactiva la itinerancia de tu línea habitual.",
      ]
    : [
        "Connect to reliable Wi-Fi before installing.",
        "In Settings, add an eSIM and scan the QR from another screen, or use the manual details.",
        "Select the eSIM for mobile data and enable its data roaming. Disable roaming on your home line.",
      ];
  const note = es
    ? "La vigencia comienza según las condiciones del plan; instalar y activar no siempre son lo mismo. El QR es privado y para un solo dispositivo. No borres la eSIM sin consultar la guía."
    : "Validity starts according to your plan conditions; installation and activation may differ. The QR is private and intended for one device. Consult the guide before deleting the eSIM.";
  const button = es
    ? "Ver mi eSIM e instrucciones"
    : "View my eSIM and instructions";
  const html = `<!doctype html><html lang="${p.locale}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body style="margin:0;background:#f2f7ff;color:#15223b;font-family:Arial,sans-serif"><div style="display:none;max-height:0;overflow:hidden">${title}. ${escape(p.name)} · ${allowance}</div><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #d9e5f5;border-radius:24px"><tr><td style="padding:30px 24px"><p style="font-size:24px;font-weight:bold;margin:0 0 28px">MyTrip<span style="color:#1269ed">Sim</span><span style="color:#ff873c">.</span></p><h1 style="font-size:27px;line-height:1.2">${title}</h1><p style="font-size:16px;line-height:1.6">${intro}</p><p style="padding:16px;background:#edf5ff;border-radius:14px;font-size:17px"><strong>${escape(p.name)}</strong><br>${allowance} · ${p.days} ${es ? "días" : "days"}<br><small>${es ? "Pedido" : "Order"} #${escape(p.reference)}</small></p><p style="text-align:center"><img src="cid:${escape(p.qrContentId)}" width="230" height="230" alt="${es ? "QR privado de instalación de tu eSIM" : "Private installation QR for your eSIM"}" style="display:block;margin:auto"></p><p style="text-align:center"><a href="${escape(p.link)}" style="display:inline-block;padding:16px 22px;background:#1269ed;color:#fff;text-decoration:none;border-radius:14px;font-size:16px;font-weight:bold">${button}</a></p><h2 style="font-size:21px">${es ? "Instalación, paso a paso" : "Installation, step by step"}</h2><ol style="font-size:16px;line-height:1.6;padding-left:22px">${steps.map((s) => `<li style="margin-bottom:10px">${s}</li>`).join("")}</ol><h2 style="font-size:21px">${es ? "Instalación manual" : "Manual installation"}</h2><p style="font-size:15px;line-height:1.6;overflow-wrap:anywhere">SM-DP+: <strong>${escape(p.smdpAddress)}</strong><br>${es ? "Código de activación" : "Activation code"}: <strong>${escape(p.activationCode)}</strong></p><p style="font-size:14px;line-height:1.6;color:#526785">${note}</p><p style="font-size:14px"><a href="https://www.mytripsim.com/${p.locale}/${es ? "faq" : "faq"}" style="color:#1269ed">${es ? "Centro de ayuda" : "Help center"}</a></p></td></tr></table></td></tr></table></body></html>`;
  return {
    subject: `${title} · ${p.name}`,
    html,
    text: `MyTripSim\n${title}\n\n${intro}\n\n${p.name} · ${allowance} · ${p.days} ${es ? "días" : "days"}\n#${p.reference}\n\n${button}: ${p.link}\n\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nSM-DP+: ${p.smdpAddress}\n${es ? "Código de activación" : "Activation code"}: ${p.activationCode}\n\n${note}`,
  };
}
