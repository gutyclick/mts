export type PaymentMode = "test" | "live";
export function paymentFormMatchesMode(
  secret: unknown,
  publicKey: string,
  mode: PaymentMode,
) {
  return (
    typeof secret === "string" &&
    secret.startsWith(`cs_${mode}_`) &&
    publicKey.startsWith(`pk_${mode}_`)
  );
}
export function paymentMode(
  env: Record<string, string | undefined>,
): PaymentMode {
  const mode = env.CHECKOUT_PAYMENT_MODE ?? "test";
  if (mode !== "test" && mode !== "live")
    throw new Error("Invalid payment mode");
  return mode;
}
export function paymentEnvironment(
  env: Record<string, string | undefined>,
  mode = paymentMode(env),
) {
  const prefix = mode === "live" ? "STRIPE_LIVE" : "STRIPE_TEST";
  return {
    mode,
    live: mode === "live",
    secret: env[`${prefix}_SECRET_KEY`] ?? "",
    publicKey: env[`${prefix}_PUBLISHABLE_KEY`] ?? "",
    webhook: env[`${prefix}_WEBHOOK_SECRET`] ?? "",
    enabled: env[`${prefix}_CHECKOUT_ENABLED`] === "true",
  };
}
