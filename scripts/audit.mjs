import { chromium } from "@playwright/test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const failures = [];
for (const width of [360, 768, 1024, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 950 } });
  for (const path of [
    "/en",
    "/es",
    "/es/destinos",
    "/en/esim/japan",
    "/es/compatibilidad",
  ]) {
    await page.goto(`http://localhost:3000${path}`, {
      waitUntil: "networkidle",
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    if (overflow) failures.push({ width, path, issue: "horizontal overflow" });
    if (width === 360 || width === 1440) {
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      const results = await page.evaluate(() =>
        window.axe.run(document, {
          runOnly: {
            type: "tag",
            values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
          },
        }),
      );
      for (const violation of results.violations)
        failures.push({
          width,
          path,
          issue: violation.id,
          impact: violation.impact,
          nodes: violation.nodes.map((node) => ({
            target: node.target,
            summary: node.failureSummary,
          })),
        });
    }
  }
  await page.close();
}
await browser.close();
console.log(JSON.stringify(failures, null, 2));
if (failures.length) process.exitCode = 1;
