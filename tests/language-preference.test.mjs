import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import { NextRequest, NextResponse } from "next/server.js";
import * as language from "../src/lib/language-preference.ts";
import * as routing from "../src/lib/portal/routing.ts";
import {
  preferredLanguage,
  languageEntryPath,
  languagePreferenceCookie,
} from "../src/lib/language-preference.ts";

test("real proxy negotiates neutral URLs without losing campaigns, overriding explicit links or caching another visitor's preference", async () => {
  const exports = {};
  const dependencies = {
    "next/server": { NextRequest, NextResponse },
    "./lib/language-preference": language,
    "./lib/portal/routing": routing,
    "./lib/supabase/auth-proxy": {
      sessionResponse: async () => NextResponse.next(),
    },
  };
  vm.runInNewContext(
    ts.transpileModule(readFileSync("src/proxy.ts", "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    { exports, Headers, require: (name) => dependencies[name] },
  );
  const first = await exports.proxy(
    new NextRequest("https://www.mytripsim.com/?utm_source=campaign", {
      headers: { "accept-language": "es-PA,en;q=0.5" },
    }),
  );
  assert.equal(first.status, 307);
  assert.equal(
    first.headers.get("location"),
    "https://www.mytripsim.com/es?utm_source=campaign",
  );
  assert.match(first.headers.get("cache-control"), /private, no-store/);
  assert.equal(first.headers.get("vary"), "Accept-Language, Cookie");
  const saved = await exports.proxy(
    new NextRequest("https://www.mytripsim.com/", {
      headers: { "accept-language": "es", cookie: "mytripsim_language=en" },
    }),
  );
  assert.equal(saved.headers.get("location"), "https://www.mytripsim.com/en");
  const explicit = await exports.proxy(
    new NextRequest("https://www.mytripsim.com/en/esim/japan", {
      headers: { "accept-language": "es" },
    }),
  );
  assert.equal(explicit.headers.get("location"), null);
  const portal = await exports.proxy(
    new NextRequest("https://portal.mytripsim.com/", {
      headers: { host: "portal.mytripsim.com", "accept-language": "en-US" },
    }),
  );
  assert.equal(
    portal.headers.get("location"),
    "https://portal.mytripsim.com/en",
  );
  assert.equal(portal.headers.get("x-robots-tag"), "noindex, nofollow");
});
test("browser language recognizes regional Spanish and English and respects quality ordering", () => {
  assert.equal(preferredLanguage(null, "es-PA,es;q=0.9,en;q=0.8"), "es");
  assert.equal(preferredLanguage(null, "en-US,en;q=0.9,es;q=0.8"), "en");
  assert.equal(preferredLanguage(null, "fr-FR,es-419;q=0.8,en;q=0.5"), "es");
  assert.equal(preferredLanguage(null, "es;q=0,en;q=0.7"), "en");
  assert.equal(preferredLanguage(null, "en;q=0.2,es;q=0.9"), "es");
  assert.equal(preferredLanguage(null, "es;q=garbage,en;q=0.5"), "en");
  assert.equal(preferredLanguage(null, "de-DE,fr;q=0.8"), "en");
  assert.equal(preferredLanguage(null, null), "en");
});
test("manual preference wins; localized links and API paths never redirect", () => {
  assert.equal(preferredLanguage("es", "en-US"), "es");
  assert.equal(preferredLanguage("en", "es-PA"), "en");
  assert.equal(preferredLanguage("invalid", "es-PA"), "es");
  assert.equal(languageEntryPath("/", "es", "en-US"), "/es");
  assert.equal(languageEntryPath("/portal", null, "en-US"), "/portal/en");
  for (const path of [
    "/es",
    "/en",
    "/es/esim/japan",
    "/en/checkout/result",
    "/api/payments/yappy/ipn",
    "/portal/es/viajes",
  ])
    assert.equal(languageEntryPath(path, null, "es"), null);
  assert.equal(
    languagePreferenceCookie("es", true),
    "mytripsim_language=es; Path=/; Max-Age=31536000; SameSite=Lax; Secure",
  );
});
