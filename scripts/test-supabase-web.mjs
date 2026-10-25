// Isolated integration test: a real PostgreSQL database behind a local Data API
// fixture and a production Next server. Never uses the user's remote database.
import { PGlite } from "@electric-sql/pglite";
import { chromium, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { once } from "node:events";

const db = new PGlite();
const apiPort = 55440;
const webPort = 3100;
const env = {
  ...process.env,
  SUPABASE_URL: `http://127.0.0.1:${apiPort}`,
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_example",
};
const children = [];
let browser;
let offline = false;
let hits = 0;
const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const api = createServer(async (req, res) => {
  if (offline) {
    res.writeHead(503).end();
    return;
  }
  try {
    if (req.headers.apikey !== env.SUPABASE_PUBLISHABLE_KEY) {
      res.writeHead(401).end();
      return;
    }
    const url = new URL(req.url, env.SUPABASE_URL);
    const plans = url.pathname === "/rest/v1/catalog_plans";
    if (!plans && url.pathname !== "/rest/v1/published_catalog_destinations") {
      res.writeHead(404).end();
      return;
    }
    const slug = url.searchParams.get("destination_slug")?.replace(/^eq\./, "");
    const limit = Number(url.searchParams.get("limit"));
    const offset = Number(url.searchParams.get("offset"));
    const result = plans
      ? await db.query(
          "select * from catalog_plans where destination_slug = $1 order by data_gb,days,id limit $2 offset $3",
          [slug, limit, offset],
        )
      : await db.query(
          "select * from published_catalog_destinations order by slug limit $1 offset $2",
          [limit, offset],
        );
    hits++;
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify(result.rows));
  } catch {
    res.writeHead(500).end();
  }
});
function next(args) {
  const child = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", ...args],
    { env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout.on("data", (b) => {
    output = (output + b).slice(-12000);
  });
  child.stderr.on("data", (b) => {
    output = (output + b).slice(-12000);
  });
  children.push(child);
  return { child, output: () => output };
}
async function edit(sql) {
  await db.exec(`reset role; ${sql}; set role anon;`);
}
try {
  await db.exec("create role anon; create role authenticated;");
  await db.exec(read("../supabase/migrations/20261024000100_catalog.sql"));
  await db.exec(read("../supabase/seed.sql"));
  await db.exec("set role anon");
  api.listen(apiPort, "127.0.0.1");
  await once(api, "listening");
  if (!process.argv.includes("--skip-build")) {
    console.log("Building the connected catalog against isolated PostgreSQL.");
    const build = next(["build"]);
    const [code] = await once(build.child, "exit");
    if (code !== 0) throw new Error(build.output());
  }
  const server = next(["start", "-p", String(webPort)]);
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(`http://localhost:${webPort}/en/faq`);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) throw new Error(server.output());
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const page = await browser.newPage();
  const base = `http://localhost:${webPort}`;
  await page.goto(`${base}/en/esim/afghanistan`);
  await expect(page.locator(".plan-option input")).toHaveCount(6);
  await edit(
    "update catalog_plans set data_gb = 2, allowance = '2GB', details = jsonb_set(details, '{dataGb}', '2') where id = 'AF_1_7'",
  );
  await page.reload();
  await expect(page.locator(".selected-plan-stats")).toContainText("2GB");
  await edit(
    "update catalog_plans set is_published = false where id = 'AF_1_7'",
  );
  await page.reload();
  await expect(page.locator(".plan-option input")).toHaveCount(5);
  assertStatus(await page.goto(`${base}/en/plan/afghanistan/AF_1_7`), 404);
  assertStatus(
    await page.goto(`${base}/en/checkout?destination=afghanistan&plan=AF_1_7`),
    404,
  );
  await edit(
    "update catalog_destinations set is_published = false where slug = 'japan'",
  );
  await page.goto(`${base}/en`);
  await expect(
    page.locator('.popular-destinations a[href="/en/esim/japan"]'),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Where are you headed?" })
    .fill("Japan");
  await expect(
    page.getByRole("option", { name: "Japan", exact: true }),
  ).toHaveCount(0);
  await page.goto(`${base}/en/destinations`);
  await page.locator("#directory-query").fill("Japan");
  await expect(
    page.locator('.destination-card[href="/en/esim/japan"]'),
  ).toHaveCount(0);
  const sitemap = await (await fetch(`${base}/sitemap.xml`)).text();
  if (/\/esim\/japan(?:<|")/.test(sitemap))
    throw new Error("Sitemap retained an unpublished destination");
  assertStatus(await page.goto(`${base}/es/esim/japan`), 404);
  offline = true;
  await page.goto(`${base}/es/esim/afghanistan`);
  await expect(
    page.getByRole("heading", { name: "No pudimos cargar esta página" }),
  ).toBeVisible();
  await expect(page.locator(".plan-option input")).toHaveCount(0);
  if (!hits)
    throw new Error("The application never queried the connected catalog");
  console.log(
    "PASS: live edits, publication, direct links, checkout, home, search, directory, sitemap and outage behavior.",
  );
} finally {
  await browser?.close();
  for (const child of children) if (child.exitCode === null) child.kill();
  api.closeAllConnections();
  await new Promise((r) => api.close(r));
  await db.close();
}
function assertStatus(response, expected) {
  if (response?.status() !== expected)
    throw new Error(
      `Expected HTTP ${expected}, received ${response?.status()}`,
    );
}
