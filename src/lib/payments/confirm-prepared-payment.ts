import type { StripeCheckoutElementsSdk } from "@stripe/stripe-js";
export async function confirmPreparedPayment(
  sdk: StripeCheckoutElementsSdk,
  expected: { live: boolean; currency: string; total: number },
  paymentMethod: string,
) {
  if (
    !Number.isSafeInteger(expected.total) ||
    expected.total <= 0 ||
    !/^pm_[a-zA-Z0-9]+$/.test(paymentMethod)
  )
    throw Error("Invalid payment confirmation");
  const loaded = await sdk.loadActions();
  if (loaded.type !== "success") throw Error("Payment initialization failed");
  const session = loaded.actions.getSession();
  if (
    session.livemode !== expected.live ||
    session.currency.toUpperCase() !== expected.currency ||
    session.total.total.minorUnitsAmount !== expected.total
  )
    throw Error("Payment total mismatch");
  return loaded.actions.confirm({ paymentMethod });
}
