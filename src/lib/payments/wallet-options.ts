import type { StripeCheckoutExpressCheckoutElementOptions } from "@stripe/stripe-js";

// Stripe owns the wallet buttons and their branding; never force unavailable wallets.
export const expressWalletOptions: StripeCheckoutExpressCheckoutElementOptions =
  {
    buttonHeight: 48,
    buttonTheme: { applePay: "black", googlePay: "black" },
    buttonType: { applePay: "buy", googlePay: "pay" },
    layout: { maxColumns: 2, maxRows: 2, overflow: "auto" },
    paymentMethodOrder: ["apple_pay", "google_pay", "link"],
    paymentMethods: {
      applePay: "auto",
      googlePay: "auto",
      link: "auto",
      paypal: "never",
      amazonPay: "never",
      klarna: "never",
    },
  };
// `ready` reports booleans; availability changes report {available: boolean}.
export function hasExpressWallet(methods: unknown): boolean {
  if (!methods || typeof methods !== "object") return false;
  return ["applePay", "googlePay", "link"].some((key) => {
    const value = (methods as Record<string, unknown>)[key];
    return (
      value === true ||
      (typeof value === "object" &&
        value !== null &&
        (value as { available?: unknown }).available === true)
    );
  });
}
