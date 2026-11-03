import type { Locale } from "../i18n.ts";

export type PaymentFeedback = {
  message: string;
  action: "correct" | "retry" | "verify";
};
const record = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};

// Read fixed provider codes, never display or record arbitrary diagnostic text.
// Supports Elements StripeError and Checkout SDK ConfirmError (camelCase).
export function paymentFeedback(
  error: unknown,
  locale: Locale,
  context: { confirmationStarted?: boolean } = {},
): PaymentFeedback {
  const e = record(error),
    nested = record(e.paymentFailed);
  const code = typeof e.code === "string" ? e.code : "";
  const decline =
    typeof nested.declineCode === "string"
      ? nested.declineCode
      : typeof e.decline_code === "string"
        ? e.decline_code
        : "";
  const reason = decline || code;
  const es = locale === "es";
  const advice = (
    message: string,
    english: string,
    action: PaymentFeedback["action"] = "correct",
  ): PaymentFeedback => ({ message: es ? message : english, action });
  if (reason === "duplicate_transaction")
    return advice(
      "Hay un intento de pago reciente. Comprueba el estado de tu pedido antes de volver a pagar.",
      "There is a recent payment attempt. Check your order status before paying again.",
      "verify",
    );
  if (reason === "insufficient_funds")
    return advice(
      "La tarjeta no tiene fondos suficientes para este importe. Elige otro método de pago; tu carrito sigue guardado.",
      "The card has insufficient funds for this amount. Choose another payment method; your cart is saved.",
    );
  if (reason === "expired_card")
    return advice(
      "La tarjeta ha vencido. Utiliza otra tarjeta o uno de los métodos de pago disponibles.",
      "The card has expired. Use another card or one of the available payment methods.",
    );
  if (["incorrect_cvc", "invalid_cvc", "incomplete_cvc"].includes(reason))
    return advice(
      "Revisa el código de seguridad de tu tarjeta antes de continuar.",
      "Check your card security code before continuing.",
    );
  if (
    ["incorrect_number", "invalid_number", "incomplete_number"].includes(reason)
  )
    return advice(
      "Revisa el número de tu tarjeta y completa todos sus dígitos.",
      "Check your card number and enter all its digits.",
    );
  if (
    [
      "invalid_expiry_month",
      "invalid_expiry_year",
      "incomplete_expiry",
    ].includes(reason)
  )
    return advice(
      "Revisa el mes y el año de caducidad de tu tarjeta.",
      "Check your card expiry month and year.",
    );
  if (
    [
      "authentication_required",
      "authentication_not_handled",
      "payment_intent_authentication_failure",
    ].includes(reason)
  )
    return advice(
      "Tu banco necesita verificar el pago. Completa la autenticación que te solicite o utiliza otro método.",
      "Your bank needs to verify the payment. Complete the requested authentication or use another method.",
    );
  if (
    ["incorrect_zip", "incorrect_address", "incomplete_address"].includes(
      reason,
    )
  )
    return advice(
      "Revisa la dirección y el código postal de facturación de tu tarjeta.",
      "Check your card billing address and postal code.",
    );
  if (["card_not_supported", "currency_not_supported"].includes(reason))
    return advice(
      "Esta tarjeta no admite este pago. Elige otro método disponible o consulta con tu banco.",
      "This card does not support this payment. Choose another available method or contact your bank.",
    );
  if (
    ["card_declined", "paymentFailed"].includes(code) ||
    [
      "generic_decline",
      "do_not_honor",
      "fraudulent",
      "lost_card",
      "stolen_card",
      "merchant_blacklist",
      "restricted_card",
      "not_permitted",
      "transaction_not_allowed",
      "pickup_card",
    ].includes(reason)
  )
    return advice(
      "El pago fue rechazado. Utiliza otro método de pago o consulta con tu banco. Tu carrito sigue guardado.",
      "The payment was declined. Use another payment method or contact your bank. Your cart is saved.",
    );
  if (e.type === "validation_error" || code === "validation_error")
    return advice(
      "Completa y revisa los datos indicados en el formulario de pago.",
      "Complete and review the highlighted payment details.",
    );
  if (context.confirmationStarted)
    return advice(
      "No hemos podido confirmar el resultado. Comprueba el estado de este pedido antes de volver a pagar; tu carrito sigue guardado.",
      "We could not confirm the outcome. Check this order’s status before paying again; your cart is saved.",
      "verify",
    );
  return advice(
    "No pudimos conectar con el pago. Tu carrito sigue guardado. Revisa tu conexión y vuelve a intentarlo.",
    "We could not connect to payment. Your cart is saved. Check your connection and try again.",
    "retry",
  );
}

export class PaymentDetailsError extends Error {
  readonly details: unknown;
  constructor(details: unknown) {
    super("Payment details need attention");
    this.name = "PaymentDetailsError";
    this.details = details;
  }
}
