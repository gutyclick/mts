import { expect, test } from "@playwright/test";
import { faqTopicSegments, type FAQTopic } from "../../src/lib/faq-topics";
import { faqTopicPath } from "../../src/lib/i18n";
import { helpContent } from "../../src/lib/help-content";

test("each FAQ topic is an independent localized page with its own metadata and questions", async ({
  page,
  request,
}) => {
  for (const locale of ["en", "es"] as const) {
    for (const topic of Object.keys(faqTopicSegments) as FAQTopic[]) {
      const path = faqTopicPath(locale, topic);
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      const html = await response.text();
      const category = helpContent[locale].categories.find(
        (category) => category.id === topic,
      )!;
      expect(html).toContain(`https://mytripsim.com${path}`);
      expect(html).toContain(`id="faq-${category.questions[0].id}"`);
      const other = helpContent[locale].categories.find(
        (category) => category.id !== topic,
      )!;
      expect(html).not.toContain(`id="faq-${other.questions[0].id}"`);
    }
  }
  for (const invalid of [
    "/en/faq/unknown",
    "/es/faq/primeros-pasos",
    "/en/help/getting-started",
    "/en/faq/primeros-pasos",
  ])
    expect((await request.get(invalid)).status()).toBe(404);
  await page.goto("/es/preguntas-frecuentes/instalacion-y-activacion");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Instalación y activación",
  );
  await page
    .getByRole("link", { name: "Cambiar idioma: English" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/faq\/installation-and-activation$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Installation & activation",
  );
  await expect(
    page.locator('.desktop-nav a[aria-current="location"]'),
  ).toHaveText("FAQ");
  await page.goto("/es/preguntas-frecuentes#installation");
  await expect(page).toHaveURL(
    /\/es\/preguntas-frecuentes\/instalacion-y-activacion$/,
  );
  await page
    .getByRole("link", { name: "Todos los temas", exact: true })
    .click();
  await expect(page.locator(".faq-topic-selector > a")).toHaveCount(6);
  await expect(page.locator(".faq-list details")).toHaveCount(0);
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain(
    "/es/preguntas-frecuentes/instalacion-y-activacion",
  );
  expect(sitemap).toContain("/en/faq/installation-and-activation");
});

test("FAQ topics, provider instructions and deep links are easy to find", async ({
  page,
}) => {
  await page.goto("/en/faq#faq-hotspot");
  const hotspot = page.locator("#faq-hotspot");
  await expect(hotspot).toHaveAttribute("open", "");
  await expect(hotspot).toContainText("Our provider confirms");
  await expect(hotspot.locator(".faq-steps li")).toHaveCount(3);
  await expect(
    hotspot.getByRole("link", { name: "Android hotspot guide" }),
  ).toHaveAttribute(
    "href",
    "https://support.google.com/android/answer/9059108?hl=en",
  );
  await expect(page).toHaveURL(/\/en\/faq\/data-and-plans#faq-hotspot$/);
  await expect(page.locator(".faq-list details")).toHaveCount(4);
  await page.getByRole("link", { name: "All topics", exact: true }).click();
  await expect(page.locator(".faq-list details")).toHaveCount(0);
  await expect(page.locator(".faq-topic-selector > a")).toHaveCount(6);
  await page.getByRole("link", { name: /^Data & plan types/ }).click();
  await expect(page.locator(".faq-category")).toHaveCount(1);
  await expect(page.locator(".faq-list details")).toHaveCount(4);
  await page.getByRole("link", { name: "All topics", exact: true }).click();
  await expect(page.locator(".faq-topic-selector > a")).toHaveCount(6);
  await page.getByLabel("Search questions").fill("vmobile.jp");
  await expect(page.locator(".faq-search-results a")).toHaveCount(1);
  await page.locator(".faq-search-results a").click();
  await expect(page).toHaveURL(
    /\/en\/faq\/connection-and-troubleshooting#faq-apn-settings$/,
  );
  await expect(page.locator("#faq-apn-settings")).toContainText(
    "Do not use vmobile.jp for other destinations",
  );
  await page.getByLabel("Search questions").fill("vmobile.jp");
  await expect(page.locator(".faq-list details")).toHaveCount(1);
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.getByLabel("Search questions")).toBeFocused();
  await expect(page.locator(".faq-list details")).toHaveCount(5);
});

test("FAQ choices persist across reload and language, with useful next steps", async ({
  page,
}) => {
  await page.goto("/es/preguntas-frecuentes#faq-dual-sim");
  const article = page.locator("#faq-dual-sim");
  await article.getByRole("button", { name: "Sí, me ayudó" }).click();
  await expect(
    article.getByRole("button", { name: "Sí, me ayudó" }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(article).toContainText("no se envía a nuestro equipo");
  await page.reload();
  await expect(
    article.getByRole("button", { name: "Sí, me ayudó" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.goto("/en/faq#faq-dual-sim");
  await expect(
    article.getByRole("button", { name: "Yes, it helped" }),
  ).toHaveAttribute("aria-pressed", "true");
  await article.getByRole("button", { name: "I need more help" }).click();
  await expect(
    article.getByRole("heading", { name: "Let’s find your next step" }),
  ).toBeVisible();
  await expect(article).toContainText("this does not send a support request");
  await article.locator('.faq-related a[href$="#faq-data-roaming"]').click();
  await expect(page).toHaveURL(
    /\/en\/faq\/connection-and-troubleshooting#faq-data-roaming$/,
  );
  await expect(page.locator(".faq-list details")).toHaveCount(5);
  await expect(page.locator("#faq-data-roaming")).toHaveAttribute("open", "");
  await expect(page.locator("#faq-data-roaming summary")).toBeFocused();
  await expect(page.locator("#faq-data-roaming")).toContainText(
    "requires data roaming to be ON",
  );
});

test("FAQ feedback still works when browser storage is blocked", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "setItem", {
      value: () => {
        throw new Error("Storage unavailable");
      },
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/en/faq#faq-qr-code-device");
  const article = page.locator("#faq-qr-code-device");
  await article.getByRole("button", { name: "Yes, it helped" }).click();
  await expect(article).toContainText("Your browser could not save it");
  await expect(
    article.getByRole("button", { name: "Yes, it helped" }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.reload();
  await expect(
    article.getByRole("button", { name: "Yes, it helped" }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(errors).toEqual([]);
});

test("more help offers a copyable question and a manual fallback", async ({
  page,
}) => {
  await page.goto("/es/preguntas-frecuentes#faq-hotspot");
  const article = page.locator("#faq-hotspot");
  await article.getByRole("button", { name: "Necesito más ayuda" }).click();
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as Window & { copiedQuestion?: string }).copiedQuestion =
            text;
        },
      },
    });
  });
  await article.getByRole("button", { name: "Copiar mi consulta" }).click();
  await expect(article).toContainText("Consulta copiada");
  expect(
    await page.evaluate(
      () => (window as Window & { copiedQuestion?: string }).copiedQuestion,
    ),
  ).toContain("/es/preguntas-frecuentes/datos-y-planes#faq-hotspot");
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error("Clipboard denied");
        },
      },
    });
  });
  await article.getByRole("button", { name: "Copiar mi consulta" }).click();
  await expect(article).toContainText(
    "Selecciona y copia la consulta de abajo",
  );
  await expect(article.getByLabel("Tu consulta", { exact: true })).toHaveValue(
    /Modelo del teléfono/,
  );
  await expect(
    article.getByLabel("Tu consulta", { exact: true }),
  ).toHaveAttribute("readonly", "");
});
