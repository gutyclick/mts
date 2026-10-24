import { expect, test } from "@playwright/test";

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
  await expect(page.locator(".faq-list details")).toHaveCount(29);
  await page.getByRole("button", { name: /^Data & plan types/ }).click();
  await expect(page.locator(".faq-category")).toHaveCount(1);
  await expect(page.locator(".faq-list details")).toHaveCount(4);
  await page.getByRole("button", { name: "All topics", exact: true }).click();
  await page.getByLabel("Search questions").fill("vmobile.jp");
  await expect(page.locator(".faq-list details")).toHaveCount(1);
  await page.locator("#faq-apn-settings summary").click();
  await expect(page.locator("#faq-apn-settings")).toContainText(
    "Do not use vmobile.jp for other destinations",
  );
  await page.getByRole("button", { name: "Clear search", exact: true }).click();
  await expect(page.getByLabel("Search questions")).toBeFocused();
  await expect(page.locator(".faq-list details")).toHaveCount(29);
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
  await page.getByRole("button", { name: /^Phones & compatibility/ }).click();
  await article.getByRole("button", { name: "I need more help" }).click();
  await expect(
    article.getByRole("heading", { name: "Let’s find your next step" }),
  ).toBeVisible();
  await expect(article).toContainText("this does not send a support request");
  await article.locator('.faq-related a[href="#faq-data-roaming"]').click();
  await expect(page.locator(".faq-list details")).toHaveCount(29);
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
  ).toContain("/es/preguntas-frecuentes#faq-hotspot");
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
