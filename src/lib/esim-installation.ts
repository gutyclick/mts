export function installationLinks(smdp: string, code: string) {
  if (
    typeof smdp !== "string" ||
    typeof code !== "string" ||
    !/^[a-zA-Z0-9.-]{1,253}$/.test(smdp) ||
    !/^[a-zA-Z0-9_-]{1,2048}$/.test(code)
  )
    return null;
  const query = new URLSearchParams({ carddata: `LPA:1$${smdp}$${code}` });
  return {
    ios: `https://esimsetup.apple.com/esim_qrcode_provisioning?${query}`,
    android: `https://esimsetup.android.com/esim_qrcode_provisioning?${query}`,
  };
}
export function shouldPollDelivery(
  units: { state: string }[],
  attempts: number,
) {
  return (
    attempts < 120 &&
    (!units.length ||
      units.some((u) =>
        ["queued", "provider_pending", "ready"].includes(u.state),
      ))
  );
}

export function isPreparingDelivery(
  states: string[],
  publishedProfiles: number,
) {
  return (
    !states.length ||
    states.some((s) => ["queued", "provider_pending"].includes(s)) ||
    states.filter((s) => ["ready", "sent"].includes(s)).length >
      publishedProfiles
  );
}
