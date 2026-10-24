import { chromium } from "@playwright/test";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const browser = await chromium.launch({ channel: "msedge", headless: true });
const failures = [];
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
for (const width of [320, 360, 390, 430, 768, 1024, 1440]) {
  const page = await browser.newPage({ viewport: { width, height: 950 } });
  for (const path of [
    "/en",
    "/es",
    "/es/destinos",
    "/en/esim/japan",
    "/es/compatibilidad",
    "/es/preguntas-frecuentes",
    "/es/ayuda",
  ]) {
    await page.goto(`${baseURL}${path}`, {
      waitUntil: "networkidle",
    });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    if (overflow) failures.push({ width, path, issue: "horizontal overflow" });
    if (width === 360 || width === 1440) {
      await page.addScriptTag({ path: require.resolve("axe-core/axe.min.js") });
      async function auditState(state) {
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
            state,
            issue: violation.id,
            impact: violation.impact,
            nodes: violation.nodes.map((node) => ({
              target: node.target,
              summary: node.failureSummary,
            })),
          });
      }
      await auditState("initial");
      if (path === "/es/preguntas-frecuentes") {
        await page.locator("#faq-hotspot summary").click();
        await page.evaluate(() =>
          Promise.allSettled(
            document.getAnimations().map((animation) => animation.finished),
          ),
        );
        await auditState("expanded-answer");
        await page
          .locator("#faq-hotspot")
          .getByRole("button", { name: "Necesito más ayuda" })
          .click();
        await auditState("more-help");
        if (
          await page.evaluate(
            () => document.documentElement.scrollWidth > window.innerWidth,
          )
        )
          failures.push({
            width,
            path,
            state: "more-help",
            issue: "horizontal overflow",
          });
      }
    }
  }
  await page.close();
}
await browser.close();
console.log(JSON.stringify(failures, null, 2));
if (failures.length) process.exitCode = 1;
