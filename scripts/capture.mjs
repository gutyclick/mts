import { chromium } from "@playwright/test";
import { mkdir, readFile } from "node:fs/promises";
const catalog = JSON.parse(await readFile("src/data/plans.json", "utf8"));
const examplePlan =
  catalog.japan.find((plan) => plan.kind === "fixed" && plan.dataGb === 5) ??
  catalog.japan[0];
const planPath = `/plan/japan/${encodeURIComponent(examplePlan.id)}`;
const checkoutQuery = `?destination=japan&plan=${encodeURIComponent(examplePlan.id)}`;
await mkdir("docs/previews", { recursive: true });
const browser = await chromium.launch({ channel: "msedge", headless: true });
const baseURL = process.env.BASE_URL ?? "http://localhost:3000";
for (const [name, width, height, path, fullPage = true] of [
  ["home-desktop", 1440, 1000, "/en"],
  ["home-mobile", 390, 844, "/es"],
  ["how-desktop", 1440, 1000, "/es/como-funciona"],
  ["how-tablet", 768, 1024, "/en/how-it-works"],
  ["how-mobile", 390, 844, "/es/como-funciona", false],
  ["plans-desktop", 1440, 1000, "/en/esim/japan", false],
  [
    "plans-afghanistan-desktop",
    1440,
    1000,
    "/es/esim/afghanistan?plan=AF_1_7",
    false,
  ],
  [
    "plans-afghanistan-mobile",
    390,
    844,
    "/es/esim/afghanistan?plan=AF_1_7",
    false,
  ],
  ["regional-networks-desktop", 1440, 1000, "/es/esim/europe", false],
  ["regional-networks-mobile", 390, 844, "/es/esim/europe", false],
  ["faq-desktop", 1440, 1000, "/en/faq", false],
  ["faq-mobile", 390, 844, "/es/preguntas-frecuentes", false],
  [
    "faq-topic-desktop",
    1440,
    1000,
    "/es/preguntas-frecuentes/instalacion-y-activacion",
    false,
  ],
  [
    "faq-topic-mobile",
    390,
    844,
    "/es/preguntas-frecuentes/instalacion-y-activacion",
    false,
  ],
  ["directory-mobile", 390, 844, "/es/destinos", false],
  ["mobile-app", 390, 844, "/es", false],
  ["plans-mobile", 390, 844, "/es/esim/japan", false],
  ["tablet-home", 768, 1024, "/es", false],
  ["plan-detail-desktop", 1440, 1000, `/en${planPath}`, false],
  ["plan-detail-mobile", 390, 844, `/es${planPath}`, false],
  ["checkout-desktop", 1440, 1000, `/en/checkout${checkoutQuery}`, false],
  ["checkout-mobile", 390, 844, `/es/compra${checkoutQuery}`, false],
  ["account-register-mobile", 390, 844, "/es/crear-cuenta", false],
  ["account-forgot-mobile", 390, 844, "/es/recuperar-contrasena", false],
  ["install-mobile", 390, 844, "/es/instalar", false],
  ["studio-desktop", 1440, 1000, "/en/studio", false],
  ["studio-mobile", 390, 844, "/es/estudio", false],
]) {
  if (process.env.CAPTURE_SCOPE && !name.startsWith(process.env.CAPTURE_SCOPE))
    continue;
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
  await page.screenshot({ path: `docs/previews/${name}.png`, fullPage });
  if (name === "plans-afghanistan-mobile") {
    await page
      .locator(".selected-plan-panel")
      .evaluate((el) =>
        window.scrollTo(
          0,
          window.scrollY + el.getBoundingClientRect().top - 85,
        ),
      );
    await page.screenshot({
      path: "docs/previews/plans-afghanistan-mobile-summary.png",
    });
  }
  if (name === "how-mobile") {
    await page
      .locator(".how-preparation")
      .evaluate((el) =>
        window.scrollTo(
          0,
          window.scrollY + el.getBoundingClientRect().top - 85,
        ),
      );
    await page.screenshot({ path: "docs/previews/how-mobile-preparation.png" });
  }
  if (name === "plans-desktop" || name === "plans-mobile") {
    await page.locator(".plan-technical-details > summary").click();
    await page
      .locator(".plan-information")
      .evaluate((el) =>
        window.scrollTo(
          0,
          window.scrollY + el.getBoundingClientRect().top - 90,
        ),
      );
    await page.screenshot({ path: `docs/previews/${name}-information.png` });
    await page
      .locator(".destination-guide")
      .evaluate((el) =>
        window.scrollTo(
          0,
          window.scrollY + el.getBoundingClientRect().top - 90,
        ),
      );
    await page.screenshot({ path: `docs/previews/${name}-guide.png` });
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  if (name.startsWith("regional-networks")) {
    await page
      .locator("summary")
      .filter({ hasText: "Países y territorios incluidos" })
      .click();
    await page.locator(".plan-technical-details > summary").click();
    await page.getByText("Operadores por destino", { exact: true }).click();
    await page
      .locator(".plan-network-disclosure")
      .first()
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: `docs/previews/${name}-expanded.png` });
    await page
      .locator(".plan-regional-networks")
      .evaluate((el) =>
        window.scrollTo(
          0,
          window.scrollY + el.getBoundingClientRect().top - 110,
        ),
      );
    await page.screenshot({ path: `docs/previews/${name}-table.png` });
  }
  if (name === "plan-detail-desktop" || name === "plan-detail-mobile") {
    await page
      .getByRole("button", {
        name:
          name === "plan-detail-mobile"
            ? "Verificar compatibilidad"
            : "Check compatibility",
        exact: true,
      })
      .click();
    await page.screenshot({ path: `docs/previews/${name}-compatibility.png` });
    const checker = page.getByRole("dialog");
    await checker.getByRole("button", { name: /Apple/ }).click();
    await checker.locator(".compat-footer .button-primary").click();
    await checker.locator('input[type="search"]').fill("iPhone 16");
    await page.screenshot({
      path: `docs/previews/${name}-compatibility-search.png`,
    });
    await page.keyboard.press("Escape");
  }
  if (name === "plans-mobile") {
    await page.locator(".plan-option input").nth(1).check();
    await page.locator(".plan-information").scrollIntoViewIfNeeded();
    await page.screenshot({ path: "docs/previews/mobile-plan-selection.png" });
  }
  if (name === "checkout-mobile" || name === "checkout-desktop") {
    await page.locator(".checkout-summary .cart-item").first().waitFor();
    await page.screenshot({
      path: `docs/previews/${name}.png`,
      fullPage: true,
    });
  }
  if (name === "faq-mobile" || name === "faq-desktop") {
    await page.goto(`${baseURL}${path}#faq-hotspot`, {
      waitUntil: "networkidle",
    });
    await page.locator("#faq-hotspot summary").focus();
    await page.waitForFunction(
      () => document.querySelector("#faq-hotspot")?.open === true,
    );
    await page.evaluate(() =>
      Promise.allSettled(
        document.getAnimations().map((animation) => animation.finished),
      ),
    );
    await page.screenshot({ path: `docs/previews/${name}-answer.png` });
    await page
      .locator("#faq-hotspot")
      .getByRole("button", {
        name: name === "faq-mobile" ? "Necesito más ayuda" : "I need more help",
      })
      .click();
    await page.locator("#faq-hotspot .faq-next-step").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `docs/previews/${name}-help.png` });
  }
  await page.close();
}
await browser.close();
