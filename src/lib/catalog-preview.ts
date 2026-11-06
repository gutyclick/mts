/** Explicit local-only preview; never enabled on Vercel or CI by accident. */
export function catalogPreviewEnabled(env: Record<string, string | undefined>) {
  return (
    env.CATALOG_REDESIGN_PREVIEW === "true" &&
    !env.VERCEL &&
    !env.VERCEL_ENV &&
    !env.CI
  );
}
