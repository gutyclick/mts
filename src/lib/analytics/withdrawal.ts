export function needsStatsWithdrawal(
  choice: string | null,
  blocked: boolean,
  hasSession: boolean,
) {
  return hasSession && (blocked || choice !== "yes");
}
export async function attemptStatsWithdrawal(
  cohort: string | null,
  forget: (hash: string) => PromiseLike<{ data: unknown; error: unknown }>,
) {
  if (!cohort) return { clearSession: true, cleanupPending: false };
  try {
    const result = await forget(cohort);
    if (!result.error && result.data === true)
      return { clearSession: true, cleanupPending: false };
  } catch {
    /* Retain the bounded token solely to retry cleanup. */
  }
  return { clearSession: false, cleanupPending: true };
}
