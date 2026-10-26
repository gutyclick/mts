// Supabase's SDK prefixes the provider SVG with a data URL. The SVG may include an XML prolog.
export function authenticatorQr(value: string) {
  if (value.length > 1000000) throw Error("Invalid authenticator image");
  let svg = value.replace(
    /^data:image\/svg\+xml;(?:utf-8|charset=utf-8),/i,
    "",
  );
  if (svg.startsWith("%")) svg = decodeURIComponent(svg);
  svg = svg.replace(/^(?:\s|<\?xml[^?]*\?>|<!--[\s\S]*?-->)+/i, "").trim();
  if (!/^<svg(?:\s|>)/i.test(svg) || !/<\/svg>\s*$/i.test(svg))
    throw Error("Invalid authenticator image");
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
