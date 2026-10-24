import { chromium } from "@playwright/test";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
const catalog = JSON.parse(await readFile("src/data/plans.json", "utf8"));
const examplePlan =
  catalog.japan.find((plan) => plan.kind === "fixed" && plan.dataGb === 5) ??
  catalog.japan[0];
const checkoutPath = `/en/checkout?destination=japan&plan=${encodeURIComponent(examplePlan.id)}`;
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
    `/en/plan/japan/${encodeURIComponent(examplePlan.id)}`,
    checkoutPath,
    "/en/my-esims",
    "/es/mis-esim?esim=trip-japan",
    "/es/instalar",
    "/es/estudio",
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
      if (path === "/es/compatibilidad") {
        await page
          .getByRole("button", {
            name: "Verificar compatibilidad",
            exact: true,
          })
          .click();
        const dialog = page.getByRole("dialog");
        await auditState("compatibility-brand");
        await dialog.getByRole("button", { name: "Google Pixel" }).click();
        await dialog
          .getByRole("button", { name: "Continuar", exact: true })
          .click();
        await auditState("compatibility-model");
        await dialog
          .getByRole("button", { name: "Mi modelo no aparece" })
          .click();
        await dialog
          .getByRole("button", { name: "Continuar", exact: true })
          .click();
        await auditState("compatibility-checks");
        await dialog
          .getByLabel("¿Dónde compraste el equipo?")
          .selectOption("unknown");
        for (const group of await dialog.getByRole("group").all())
          await group.getByLabel("No lo sé", { exact: true }).check();
        await dialog.getByRole("button", { name: "Ver resultado" }).click();
        await auditState("compatibility-result");
        if (await dialog.evaluate((el) => el.scrollWidth > el.clientWidth))
          failures.push({
            width,
            path,
            issue: "compatibility dialog horizontal overflow",
          });
        await page.keyboard.press("Escape");
      }
      if (path === checkoutPath) {
        await page
          .getByRole("button", { name: "Continue to payment preview" })
          .click();
        await auditState("payment-preview");
        await page
          .getByRole("button", { name: "Preview confirmation" })
          .click();
        await auditState("confirmation-preview");
      }
      if (path === "/en/my-esims") {
        await page.locator(".preview-controls summary").click();
        for (const state of ["empty", "loading", "error"]) {
          await page.getByLabel("Example state").selectOption(state);
          await auditState(state);
        }
      }
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
