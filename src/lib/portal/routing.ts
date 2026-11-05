/** Host routing is presentation isolation, never company authorization. */
export function isPortalHost(host: string | null): boolean {
  return host?.toLowerCase().split(":")[0] === "portal.mytripsim.com";
}

export function portalRewrite(pathname: string): string {
  if (/^\/portal(?:\/|$)/.test(pathname)) return pathname;
  if (pathname === "/") return "/portal/es";
  return /^\/(es|en)(?:\/|$)/.test(pathname)
    ? `/portal${pathname}`
    : `/portal/es${pathname}`;
}
