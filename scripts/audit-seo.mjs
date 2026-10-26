import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";

const base = (
  process.env.SEO_AUDIT_BASE ?? "https://www.mytripsim.com"
).replace(/\/$/, "");
const output = process.env.SEO_AUDIT_OUTPUT;
const canonicalBase = "https://www.mytripsim.com";
const decode = (s) =>
  s
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#x27;", "'");
const attr = (tag, name) =>
  decode(tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"))?.[1] ?? "");
async function get(path) {
  const response = await fetch(new URL(path, base), {
    redirect: "manual",
    headers: { "User-Agent": "MyTripSim-SEO-Audit/1.0" },
    signal: AbortSignal.timeout(45000),
  });
  return { response, html: await response.text() };
}
const sitemap = await get("/sitemap.xml");
assert.equal(sitemap.response.status, 200);
const urls = [...sitemap.html.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) =>
  decode(m[1]),
);
assert.ok(urls.length > 500);
assert.equal(new Set(urls).size, urls.length);
assert.ok(urls.includes(`${canonicalBase}/es/instalar`));
assert.ok(
  urls.every(
    (u) =>
      u.startsWith(canonicalBase + "/") &&
      !u.includes("?") &&
      !/\/(plan|admin|support|checkout|compra|sign-in|iniciar-sesion|mis-esim|my-esims)(\/|$)/.test(
        u,
      ),
  ),
);
const failures = [],
  pages = [];
let next = 0;
async function inspect(url) {
  const { pathname } = new URL(url);
  const { response, html } = await get(pathname);
  assert.equal(response.status, 200, `${pathname}: status`);
  const tags = [...html.matchAll(/<(?:link|meta)\b[^>]*>/gi)].map((m) => m[0]);
  const canonicals = tags
    .filter((t) => attr(t, "rel") === "canonical")
    .map((t) => attr(t, "href"));
  assert.deepEqual(canonicals, [url], `${pathname}: canonical`);
  assert.ok(
    !tags.some(
      (t) =>
        attr(t, "name") === "robots" && attr(t, "content").includes("noindex"),
    ),
    `${pathname}: noindex`,
  );
  assert.ok(!response.headers.get("x-robots-tag")?.includes("noindex"));
  const title = html.match(/<title>(.*?)<\/title>/s)?.[1];
  assert.ok(title && title.includes("MyTripSim"), `${pathname}: title`);
  assert.ok(
    tags.some(
      (t) =>
        attr(t, "name") === "description" && attr(t, "content").length > 30,
    ),
  );
  assert.equal([...html.matchAll(/<h1\b/g)].length, 1, `${pathname}: one h1`);
  const alternate = tags.filter(
    (t) => attr(t, "rel") === "alternate" && attr(t, "hreflang"),
  );
  assert.deepEqual(alternate.map((t) => attr(t, "hreflang")).sort(), [
    "en",
    "es",
    "x-default",
  ]);
  assert.ok(
    alternate.every((t) => urls.includes(attr(t, "href"))),
    `${pathname}: language alternatives must be in sitemap`,
  );
  const schemas = [
    ...html.matchAll(
      /<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
    ),
  ].map((m) => JSON.parse(m[1]));
  const links = [
    ...new Set(
      [...html.matchAll(/<a\b[^>]*href="([^"]+)"/g)]
        .map((m) => decode(m[1]))
        .filter((u) => /^\/(es|en)\/esim\//.test(u)),
    ),
  ];
  if (/\/(destinos|destinations)$/.test(pathname))
    assert.equal(
      links.length,
      urls.filter((u) => u.includes(pathname.slice(0, 3) + "/esim/")).length,
      "All destinations must be linked in initial HTML",
    );
  pages.push({
    path: pathname,
    status: response.status,
    canonical: canonicals[0],
    title: decode(title),
    languages: Object.fromEntries(
      alternate.map((t) => [attr(t, "hreflang"), attr(t, "href")]),
    ),
    schemas: schemas.map((s) => s["@type"] ?? "@graph"),
    destinationLinks: links.length,
  });
}
await Promise.all(
  Array.from({ length: 2 }, async () => {
    while (next < urls.length) {
      const url = urls[next++];
      try {
        await inspect(url);
      } catch (error) {
        failures.push({ url, error: error.message });
      }
    }
  }),
);
for (const path of [
  "/es/iniciar-sesion",
  "/en/sign-in",
  "/es/compra",
  "/es/support",
  "/es/admin",
  "/es/instalar?esim=00000000-0000-0000-0000-000000000000",
]) {
  const { response, html } = await get(path);
  assert.ok(
    response.headers.get("x-robots-tag")?.includes("noindex") ||
      /name="robots" content="[^"]*noindex/.test(html),
    `${path}: private noindex`,
  );
}
for (const path of [
  "/favicon.ico",
  "/icon.png",
  "/apple-icon.png",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.webmanifest",
]) {
  const { response } = await get(path);
  assert.equal(response.status, 200, path);
}
const robot = await get("/robots.txt");
assert.ok(robot.html.includes(`Sitemap: ${canonicalBase}/sitemap.xml`));
const alias = await get("/es/plan/panama/PA_0.1_7");
assert.equal(
  alias.response.status,
  308,
  "Legacy plan URL redirects permanently",
);
assert.equal(
  alias.response.headers.get("location"),
  "/es/esim/panama?plan=PA_0.1_7",
);
const selected = await get(
  "/es/esim/panama?plan=PA_0.1_7&utm_source=seo-audit",
);
assert.ok(
  selected.html.includes(
    `rel="canonical" href="${canonicalBase}/es/esim/panama"`,
  ),
);
const titleOwners = new Map();
for (const page of pages) {
  assert.ok(
    !titleOwners.has(page.title),
    `Duplicate title: ${page.path} / ${titleOwners.get(page.title)}`,
  );
  titleOwners.set(page.title, page.path);
  for (const [locale, url] of Object.entries(page.languages)) {
    if (locale === "x-default") continue;
    const translated = pages.find((p) => p.canonical === url);
    assert.ok(
      translated &&
        JSON.stringify(translated.languages) === JSON.stringify(page.languages),
      `Reciprocal hreflang: ${page.path}`,
    );
  }
}
const report = {
  at: new Date().toISOString(),
  base,
  sitemapUrls: urls.length,
  checked: pages.length,
  failures,
  pages,
};
if (output) writeFileSync(output, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify(
    { base, sitemapUrls: urls.length, checked: pages.length, failures },
    null,
    2,
  ),
);
assert.equal(failures.length, 0, "SEO crawl failures");
