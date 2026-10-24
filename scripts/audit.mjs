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
    "/en/how-it-works",
    "/es/como-funciona",
    "/es/destinos",
    "/en/esim/japan",
    "/es/esim/europe",
    "/es/compatibilidad",
    "/es/preguntas-frecuentes",
    "/es/preguntas-frecuentes/datos-y-planes",
    "/en/faq/installation-and-activation",
    "/es/ayuda",
    `/en/plan/japan/${encodeURIComponent(examplePlan.id)}`,
    checkoutPath,
    "/en/my-esims",
    "/es/mis-esim?esim=trip-japan",
    "/es/instalar",
    "/es/estudio",
  ]) {
    if (
      process.env.AUDIT_SCOPE === "how" &&
      !["/en", "/es", "/en/how-it-works", "/es/como-funciona"].includes(path)
    )
      continue;
    if (
      process.env.AUDIT_SCOPE === "faq" &&
      !/faq|preguntas-frecuentes/.test(path)
    )
      continue;
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
      if (path === "/es/esim/europe") {
        await page
          .locator("summary")
          .filter({ hasText: "Países y territorios incluidos" })
          .click();
        await page.getByText("Operadores por destino", { exact: true }).click();
        await auditState("regional-coverage-and-networks-expanded");
      }
      if (path === "/en/esim/japan") {
        await page.locator(".destination-faq summary").first().click();
        await auditState("country-guide-faq-expanded");
        await page.getByLabel("Sort by", { exact: true }).selectOption("days");
        await page.locator(".plan-option input").last().check();
        await auditState("inline-plan-selected");
        await page.getByLabel("Data allowance").selectOption("50");
        await page.getByLabel("Duration", { exact: true }).selectOption("7");
        await auditState("inline-plan-empty");
      }
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
        for (const group of await dialog
          .locator("fieldset.compat-question")
          .all())
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
        await page.getByLabel("Buscar preguntas").fill("roaming");
        await auditState("faq-index-search-results");
      }
      if (path === "/es/preguntas-frecuentes/datos-y-planes") {
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
