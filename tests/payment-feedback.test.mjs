import test from "node:test";
import assert from "node:assert/strict";
import { paymentFeedback } from "../src/lib/payments/payment-feedback.ts";

test("Checkout SDK and Elements decline shapes produce the same actionable bilingual advice", () => {
  for (const locale of ["es", "en"]) {
    for (const decline of [
      "insufficient_funds",
      "expired_card",
      "incorrect_cvc",
      "authentication_required",
    ]) {
      const classic = paymentFeedback(
        { code: "card_declined", decline_code: decline },
        locale,
      );
      const checkout = paymentFeedback(
        { code: "paymentFailed", paymentFailed: { declineCode: decline } },
        locale,
      );
      assert.deepEqual(checkout, classic);
      assert.equal(checkout.action, "correct");
      assert.ok(checkout.message.length > 30);
    }
  }
});
test("sensitive decline reasons and untrusted messages never leak through customer feedback", () => {
  for (const code of [
    "fraudulent",
    "lost_card",
    "stolen_card",
    "merchant_blacklist",
  ]) {
    const result = paymentFeedback(
      {
        code: "paymentFailed",
        message: "private diagnostic",
        paymentFailed: { declineCode: code },
      },
      "es",
    );
    assert.match(result.message, /rechaz/);
    assert.doesNotMatch(result.message, /private|fraud|robad|perdid/);
  }
});
test("duplicate or uncertain confirmation checks the existing order instead of inviting a second charge", () => {
  for (const error of [
    { decline_code: "duplicate_transaction" },
    { type: "api_connection_error" },
    { code: "processing_error" },
    null,
  ]) {
    const result = paymentFeedback(error, "es", { confirmationStarted: true });
    assert.equal(result.action, "verify");
    assert.match(result.message, /estado/);
    assert.doesNotMatch(result.message, /no se ha cobrado|sin cargos/);
  }
});
test("pre-confirmation failure preserves the cart and card validation has specific guidance", () => {
  assert.equal(paymentFeedback(null, "en").action, "retry");
  assert.match(paymentFeedback(null, "en").message, /cart/);
  assert.match(
    paymentFeedback({ code: "incomplete_number" }, "es").message,
    /tarjeta/,
  );
  assert.equal(
    paymentFeedback({ code: "invalid_expiry_year" }, "es").action,
    "correct",
  );
});
