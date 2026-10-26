import test from "node:test";
import assert from "node:assert/strict";
import { authenticatorQr } from "../src/lib/admin/authenticator-qr.ts";
test("Supabase authenticator SVG with XML declaration is displayed as an encoded private data URL", () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0"/></svg>';
  const provider =
    '<?xml version="1.0" encoding="UTF-8"?>\n<!-- generated QR image -->\n' +
    svg;
  for (const source of [
    provider,
    "data:image/svg+xml;utf-8," + provider,
    "data:image/svg+xml;charset=utf-8," + encodeURIComponent(provider),
  ]) {
    const result = authenticatorQr(source);
    assert.equal(decodeURIComponent(result.split(",")[1]), svg);
    assert.ok(result.startsWith("data:image/svg+xml;charset=utf-8,%3Csvg"));
  }
  assert.throws(() => authenticatorQr("https://example.invalid/qr"));
  assert.throws(() => authenticatorQr("<html>bad image</html>"));
  assert.throws(() => authenticatorQr("x".repeat(1000001)));
});
