import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { formatMoney, currencyCode } from "../src/lib/currency.ts";
import {
  paymentFeedback,
  PaymentDetailsError,
} from "../src/lib/payments/payment-feedback.ts";
import { paymentFormMatchesMode } from "../src/lib/payments/checkout-mode.ts";
import { confirmPreparedPayment } from "../src/lib/payments/confirm-prepared-payment.ts";

// Execute the production component's handlers. Host-only children (Stripe Elements,
// routing and cart/context providers) are substituted; no SDK or network is used.
const source = ts.transpileModule(
  readFileSync("src/components/commerce/checkout.tsx", "utf8"),
  {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  },
).outputText;
const orderId = "55555555-5555-4555-8555-555555555555";
function descendants(node) {
  if (Array.isArray(node)) return node.flatMap(descendants);
  if (!node || typeof node !== "object") return [];
  return [node, ...descendants(node.props?.children)];
}

async function checkoutHarness({
  currency = "USD",
  locale = "es",
  authenticated = false,
  outcome,
} = {}) {
  const slots = [],
    effects = [];
  let cursor = 0,
    tree;
  const calls = {
    sessions: [],
    confirmations: 0,
    collections: 0,
    complete: 0,
    redirects: [],
    failures: 0,
  };
  const total = currency === "JPY" ? 1500 : 1000;
  const react = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots))
        slots[i] = typeof initial === "function" ? initial() : initial;
      return [
        slots[i],
        (next) => {
          slots[i] = typeof next === "function" ? next(slots[i]) : next;
        },
      ];
    },
    useRef(initial) {
      const i = cursor++;
      return (slots[i] ??= { current: initial });
    },
    useEffect(callback, deps) {
      const i = cursor++,
        previous = slots[i];
      if (
        !previous ||
        deps.some((value, n) => !Object.is(value, previous.deps[n]))
      ) {
        effects.push(() => {
          previous?.cleanup?.();
          slots[i] = { deps, cleanup: callback() };
        });
      }
    },
  };
  const cart = {
    lines: [{ destination: "panama", planId: "plan", quantity: 1 }],
    resolved: { items: [{ retailPriceCents: 1000, quantity: 1 }] },
    loading: false,
    error: null,
    ensure() {},
    retry() {},
    complete() {
      calls.complete++;
    },
  };
  const pricing = {
    currency,
    ready: true,
    busy: false,
    quote:
      currency === "USD"
        ? null
        : { id: "fx-quote", expiresAt: "2099-01-01T00:00:00Z" },
    total: () => total,
    select: async () => {},
    setPaymentBusy() {},
  };
  const router = { push: (url) => calls.redirects.push(url) };
  const sdk = {
    loadActions: async () => ({
      type: "success",
      actions: {
        getSession: () => ({
          livemode: false,
          currency: currency.toLowerCase(),
          total: { total: { minorUnitsAmount: total } },
        }),
        confirm: async () => {
          calls.confirmations++;
          if (outcome instanceof Error) throw outcome;
          return outcome;
        },
      },
    }),
  };
  const modules = {
    react,
    "react/jsx-runtime": {
      jsx: (type, props) => ({ type, props }),
      jsxs: (type, props) => ({ type, props }),
    },
    "next/link": { default: "Link" },
    "next/navigation": { useRouter: () => router },
    "lucide-react": new Proxy({}, { get: (_, name) => name }),
    "@/lib/legal-version": { legalVersion: "test-version" },
    "@/lib/i18n": { pathFor: (language, path) => `/${language}/${path}` },
    "@/lib/auth-routes": {
      authPath: (language, path) => `/${language}/${path}`,
    },
    "@/lib/experience-routes": {
      experiencePath: (language, path) => `/${language}/${path}`,
    },
    "@/lib/cart": { cartTotal: () => 1000 },
    "@/lib/currency": { formatMoney, currencyCode },
    "@/components/currency-provider": { useCurrency: () => pricing },
    "./cart-provider": { CartItems: "CartItems", useCart: () => cart },
    "./checkout-payment-fields": {
      CheckoutPaymentFields: "CheckoutPaymentFields",
      PaymentDetailsError,
    },
    "@/lib/payments/confirm-prepared-payment": { confirmPreparedPayment },
    "./payment-hold": {
      HoldCountdown: "HoldCountdown",
      usePaymentPresence: () => ({}),
    },
    "@/lib/payments/checkout-mode": { paymentFormMatchesMode },
    "@/components/simcoins/checkout-rewards": {
      CheckoutRewards: "CheckoutRewards",
    },
    "@/lib/simcoins/analytics-client": { recordSimcoinsStats() {} },
    "@/lib/payments/coupons": {},
    "@/lib/payments/payment-feedback": { paymentFeedback },
    "@/lib/analytics/client": { recordCheckoutStats() {} },
    "./checkout-coupon": { CheckoutCoupon: "CheckoutCoupon" },
    "@/app/checkout-coupons.css": {},
  };
  const exports = {};
  vm.runInNewContext(source, {
    exports,
    require(name) {
      assert.ok(name in modules, `Unexpected import: ${name}`);
      return modules[name];
    },
    AbortController,
    queueMicrotask,
    crypto: { randomUUID },
    window: { addEventListener() {}, removeEventListener() {} },
    fetch: async (url, options) => {
      if (url === "/api/checkout/config")
        return {
          ok: true,
          json: async () => ({
            enabled: true,
            mode: "test",
            publishableKey: "pk_test_mock",
            simcoinsEnabled: false,
          }),
        };
      assert.equal(url, "/api/checkout/session");
      calls.sessions.push(JSON.parse(options.body));
      return {
        ok: true,
        json: async () => ({
          orderId,
          clientSecret: "cs_test_mock",
          paymentCurrency: currency,
          paymentTotal: total,
        }),
      };
    },
  });
  const props = {
    locale,
    ...(authenticated ? { email: "buyer@example.test" } : {}),
  };
  async function render() {
    // Flush effects and their async responses between renders, as React commits do.
    for (let n = 0; n < 4; n++) {
      cursor = 0;
      tree = exports.Checkout(props);
      while (effects.length) effects.shift()();
      await new Promise((resolve) => setImmediate(resolve));
    }
  }
  function find(predicate) {
    const found = descendants(tree).find(predicate);
    assert.ok(found, "Expected checkout element");
    return found;
  }
  const fields = () =>
    find((node) => node.type === "CheckoutPaymentFields").props;
  const submitButton = () =>
    find((node) => node.type === "button" && node.props.type === "submit")
      .props;
  async function submit() {
    await find((node) => node.type === "form").props.onSubmit({
      preventDefault() {},
    });
    await render();
  }
  await render();
  fields().ref.current = {
    collect: async () => {
      calls.collections++;
      return {
        stripe: { initCheckoutElementsSdk: () => sdk },
        paymentMethod: "pm_mock",
        fail: () => {
          calls.failures++;
        },
      };
    },
  };
  fields().onReady(true);
  if (!authenticated)
    find(
      (node) => node.type === "input" && node.props.name === "email",
    ).props.onChange({ target: { value: "buyer@example.test" } });
  await render();
  return {
    calls,
    cart,
    fields,
    submitButton,
    submit,
    render,
    find,
    consent: async (name, checked) => {
      find(
        (node) => node.type === "input" && node.props.name === name,
      ).props.onChange({ target: { checked } });
      await render();
    },
  };
}

for (const [currency, locale, authenticated] of [
  ["USD", "es", false],
  ["EUR", "en", true],
  ["JPY", "es", true],
]) {
  test(`uncertain ${currency} confirmation blocks card and wallet retries, keeps cart, and links existing order (${authenticated ? "account" : "guest"})`, async () => {
    const ui = await checkoutHarness({
      currency,
      locale,
      authenticated,
      outcome: new Error("private network diagnostic"),
    });
    assert.equal(ui.fields().canPay, false);
    await ui.submit();
    assert.equal(
      ui.calls.sessions.length,
      0,
      "direct form submission cannot bypass consent",
    );
    await ui.consent("compatible", true);
    assert.equal(
      ui.fields().canPay,
      false,
      "terms remain required for wallets",
    );
    await ui.consent("terms", true);
    assert.equal(ui.fields().canPay, true);
    assert.equal(ui.submitButton().disabled, false);
    await ui.submit();
    assert.equal(ui.calls.confirmations, 1);
    assert.equal(ui.calls.sessions[0].currency, currency);
    assert.equal(ui.submitButton().disabled, true);
    assert.equal(ui.fields().canPay, false);
    const link = ui.find(
      (node) =>
        node.type === "Link" &&
        node.props.href === `/${locale}/checkout/result?order=${orderId}`,
    );
    assert.ok(link);
    assert.equal(ui.calls.complete, 0);
    assert.equal(ui.cart.lines.length, 1);
    assert.equal(ui.calls.redirects.length, 0);
    assert.doesNotMatch(
      JSON.stringify(
        descendants(ui.find((node) => node.props?.role === "alert")),
      ),
      /private network diagnostic/,
    );
    await ui.submit();
    assert.equal(
      ui.calls.confirmations,
      1,
      "programmatic resubmission must also be blocked",
    );
    assert.equal(ui.calls.sessions.length, 1);
    await ui.consent("terms", false);
    await ui.consent("terms", true);
    assert.equal(
      ui.fields().canPay,
      false,
      "changing consent must not unlock an uncertain payment",
    );
  });
}

test("a definitive declined Checkout payment keeps correction and retry available without clearing the cart", async () => {
  const ui = await checkoutHarness({
    outcome: {
      type: "error",
      error: {
        code: "paymentFailed",
        paymentFailed: { declineCode: "insufficient_funds" },
        message: "private diagnostic",
      },
    },
  });
  await ui.consent("compatible", true);
  await ui.consent("terms", true);
  await ui.submit();
  assert.equal(ui.submitButton().disabled, false);
  assert.equal(ui.fields().canPay, true);
  const alert = ui.find((node) => node.props?.role === "alert");
  assert.match(JSON.stringify(alert.props.children), /fondos suficientes/);
  assert.doesNotMatch(
    JSON.stringify(alert.props.children),
    /private diagnostic/,
  );
  assert.equal(ui.calls.complete, 0);
  await ui.submit();
  assert.equal(ui.calls.confirmations, 2);
  assert.equal(
    ui.calls.sessions[0].attemptId,
    ui.calls.sessions[1].attemptId,
    "retry reuses the same checkout attempt",
  );
  assert.equal(ui.cart.lines.length, 1);
});

test("a returned unknown Checkout error also locks retries and exposes status for the same order", async () => {
  const ui = await checkoutHarness({
    outcome: {
      type: "error",
      error: { code: null, message: "private provider diagnostic" },
    },
  });
  await ui.consent("compatible", true);
  await ui.consent("terms", true);
  await ui.submit();
  assert.equal(ui.submitButton().disabled, true);
  assert.equal(ui.fields().canPay, false);
  assert.ok(
    ui.find(
      (node) =>
        node.type === "Link" &&
        node.props.href === `/es/checkout/result?order=${orderId}`,
    ),
  );
  assert.doesNotMatch(
    JSON.stringify(
      ui.find((node) => node.props?.role === "alert").props.children,
    ),
    /private provider diagnostic/,
  );
  await ui.submit();
  assert.equal(ui.calls.confirmations, 1);
  assert.equal(ui.calls.complete, 0);
});
