export function adminAssurance(
  member: boolean,
  level: string | null,
  verifiedFactor: boolean,
) {
  const admin = member && level === "aal2" && verifiedFactor;
  return { admin, member, needsMfa: member && !admin };
}
