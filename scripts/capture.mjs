import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
await mkdir("docs/previews", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
for (const [name, width, height, path] of [
  ["home-desktop", 1440, 1000, "/en"],
  ["home-mobile", 390, 844, "/es"],
  ["plans-desktop", 1440, 1000, "/en/esim/japan"],
]) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  await page.goto(`${baseURL}${path}`, { waitUntil: "networkidle" });
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const image of document.images) image.loading = "eager";
  });
  await page.waitForFunction(() =>
    Array.from(document.images).every((image) => image.complete),
  );
  await page.screenshot({ path: `docs/previews/${name}.png`, fullPage: true });
  await page.close();
}
await browser.close();
