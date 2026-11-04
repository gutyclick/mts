import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { formatMoney } from "../src/lib/currency.ts";
const require = createRequire(import.meta.url);
const exports = {};
vm.runInNewContext(
  ts.transpileModule(
    readFileSync("src/components/commerce/checkout-coupon.tsx", "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  ).outputText,
  {
    exports,
    require: (name) =>
      name === "@/lib/currency" ? { formatMoney } : require(name),
  },
);
const props = {
  locale: "es",
  quote: null,
  busy: false,
  disabled: false,
  ready: true,
  error: "",
  onApply() {},
  onRemove() {},
};
test("coupon input is visible on initial checkout in both languages without opening a disclosure", () => {
  for (const locale of ["es", "en"]) {
    const html = renderToStaticMarkup(
      createElement(exports.CheckoutCoupon, { ...props, locale }),
    );
    assert.match(html, /name="discountCode"/);
    assert.match(html, /checkout-coupon-heading/);
    assert.doesNotMatch(html, /aria-expanded/);
    assert.match(
      html,
      locale === "es" ? /Introduce tu código/ : /Enter your code/,
    );
  }
});
test("unready and busy coupons cannot be submitted, while errors explain transient checks separately from ineligible orders", () => {
  for (const change of [{ ready: false }, { busy: true }, { disabled: true }]) {
    const html = renderToStaticMarkup(
      createElement(exports.CheckoutCoupon, { ...props, ...change }),
    );
    assert.match(html, /<button[^>]*disabled/);
  }
  assert.match(
    exports.couponErrorMessage("coupon_cost_unavailable", true),
    /segundos/,
  );
  assert.match(
    exports.couponErrorMessage("coupon_margin", true),
    /otra selección/,
  );
  const html = renderToStaticMarkup(
    createElement(exports.CheckoutCoupon, {
      ...props,
      error: "Inténtalo de nuevo",
    }),
  );
  assert.match(html, /aria-describedby="checkout-coupon-error"/);
  assert.match(html, /role="alert"/);
});

test("coupon applies directly without showing conditions", () => {
  const html = renderToStaticMarkup(
    createElement(exports.CheckoutCoupon, { ...props }),
  );
  assert.match(html, /Aplicar/);
  const applied = renderToStaticMarkup(
    createElement(exports.CheckoutCoupon, {
      ...props,
      quote: { code: "VIAJE5", discountTotal: 200, currency: "USD" },
      details: {
        code: "VIAJE5",
        minimumUsdCents: 1500,
        startsAt: null,
        endsAt: null,
        eligiblePlans: "published_fixed",
        eligibility: "not_evaluated",
      },
    }),
  );
  assert.doesNotMatch(
    applied,
    /Compra mínima|Sin vencimiento|checkout-coupon-details/,
  );
  assert.match(applied, /VIAJE5/);
  assert.match(applied, /Ahorras/);
});

test("account links return to localized checkout and account errors require verification", () => {
  for (const locale of ["es", "en"]) {
    const html = renderToStaticMarkup(
      createElement(exports.CheckoutCoupon, { ...props, locale }),
    );
    const es = locale === "es";
    assert.ok(
      html.includes(
        `/${locale}/${es ? "iniciar-sesion" : "sign-in"}?next=${encodeURIComponent(`/${locale}/${es ? "compra" : "checkout"}`)}`,
      ),
    );
    assert.ok(
      html.includes(`/${locale}/${es ? "crear-cuenta" : "sign-up"}?next=`),
    );
    assert.match(
      exports.couponErrorMessage("account_required", es),
      es ? /verificada/ : /verified/,
    );
  }
});
