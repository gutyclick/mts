import test from "node:test";
import assert from "node:assert/strict";
import { regionalLanguageHref } from "../src/lib/regional-preferences.ts";
test("language selection preserves the destination, selected plan, query and section", () => {
  assert.equal(
    regionalLanguageHref(
      "/es/esim/japan",
      "en",
      "?plan=JP_1GB&days=7",
      "#coverage",
    ),
    "/en/esim/japan?plan=JP_1GB&days=7#coverage",
  );
  assert.equal(
    regionalLanguageHref("/en/faq/installation-and-activation", "es", "", ""),
    "/es/preguntas-frecuentes/instalacion-y-activacion",
  );
});
test("private checkout and admin navigation stay on their corresponding pages", () => {
  assert.equal(
    regionalLanguageHref(
      "/es/checkout/result",
      "en",
      "?order=fixture",
      "#details",
    ),
    "/en/checkout/result?order=fixture#details",
  );
  for (const section of [
    "analytics",
    "operations",
    "refunds",
    "security",
    "tickets",
  ])
    assert.equal(
      regionalLanguageHref("/es/admin/" + section, "en"),
      "/en/admin/" + section,
    );
});
