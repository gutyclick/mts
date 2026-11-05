/** Read-only HTTP smoke test. Does not submit orders, log in or issue eSIMs. */
import assert from "node:assert/strict";
import http from "node:http";
import https from "node:https";

const target = new URL(process.env.PORTAL_TEST_URL ?? "http://127.0.0.1:3005");
const host = process.env.PORTAL_TEST_HOST ?? "portal.mytripsim.com";
function read(path, surface = host, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const client = target.protocol === "https:" ? https : http;
    const request = client.get(
      new URL(path, target),
      { headers: { Host: surface, ...extraHeaders } },
      (response) => {
        let body = "";
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () =>
          resolve({
            status: response.statusCode,
            headers: response.headers,
            body,
          }),
        );
      },
    );
    request.setTimeout(60000, () =>
      request.destroy(new Error("request_timeout")),
    );
    request.on("error", reject);
  });
}
const pages = [
  "/es",
  "/es/viajes",
  "/es/viajes/nuevo",
  "/es/viajes/europe-december",
  "/es/viajes/mexico-team/solicitar",
  "/es/revision",
  "/es/equipo",
  "/es/facturacion",
  "/es/soporte",
  "/es/acceso",
  "/en",
  "/en/trips",
  "/en/trips/new",
  "/en/trips/europe-december",
  "/en/trips/mexico-team/request",
  "/en/review",
  "/en/team",
  "/en/billing",
  "/en/support",
  "/en/access",
];
for (const path of pages) {
  const response = await read(path);
  assert.equal(response.status, 200, path);
  assert.match(response.headers["x-robots-tag"] ?? "", /noindex/, path);
  assert.match(response.headers["cache-control"] ?? "", /no-store/, path);
  assert.match(response.body, /bp-app/, path);
  assert.match(
    response.body,
    /bp-access-shell/,
    "Anonymous users see access, never company data",
  );
  assert.doesNotMatch(
    response.body,
    /EX-001|Agencia de ejemplo|Example agency/,
  );
  assert.doesNotMatch(response.body, /mts-google-consent-default/, path);
  assert.doesNotMatch(
    response.body,
    /mailto:|wa\.me\//,
    "No private business contacts in public preview",
  );
  assert.doesNotMatch(
    response.body,
    /href="\/portal\//,
    "Portal-host links retain clean paths",
  );
  console.log(`PASS portal ${path}`);
}
for (const path of [
  "/api/checkout/config",
  "/api/checkout/session",
  "/api/admin/simcoins/status",
  "/sitemap.xml",
  "/es/admin",
  "/es/compra",
  "/en/checkout",
]) {
  assert.equal(
    (await read(path)).status,
    404,
    `Retail route unavailable on portal: ${path}`,
  );
  console.log(`PASS isolated ${path}`);
}
assert.match((await read("/robots.txt")).body, /Disallow: \//);
assert.equal((await read("/api/portal")).status, 401);
assert.equal(
  (
    await read(
      "/api/portal?company=11111111-1111-4111-8111-111111111111&catalog=japan",
    )
  ).status,
  401,
);
assert.equal((await read("/logomytripsim.png")).status, 200);
const entry = await read("/");
assert.match(entry.body, /bp-app/);
const store = await read("/es", target.host, {
  "x-mytripsim-surface": "portal",
});
assert.equal(store.status, 200);
assert.match(store.body, /mts-google-consent-default/);
assert.doesNotMatch(store.body, /bp-app/);
const preview = await read("/portal/es", target.host);
assert.equal(preview.status, 200);
assert.match(preview.body, /bp-access-shell/);
console.log(
  "PASS robots, logo, root rewrite, spoofed surface header and ordinary store",
);
