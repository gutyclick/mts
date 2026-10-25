import { expect, test } from "@playwright/test";

test("search supports keyboard, localized destination and trip duration", async ({
  page,
}) => {
  await page.goto("/es");
  await expect(page.locator("html")).toHaveAttribute("lang", "es");
  const input = page.getByRole("combobox", {
    name: "¿Cuál es tu próximo destino?",
  });
  await input.fill("japón");
  await page.getByLabel("Duración del viaje").selectOption("15");
  await input.focus();
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/es\/esim\/japan\?days=15/);
  await expect(
    page.getByRole("heading", { name: "Japón eSIM", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".plan-option").first()).toBeVisible();
  for (const validity of await page
    .locator(".plan-option .plan-option-duration")
    .all())
    await expect(validity).toHaveText("15 días");
  await page
    .getByRole("link", { name: "Cambiar idioma: English" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/en\/esim\/japan/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
});
test("plan selection updates inline and never completes a purchase", async ({
  page,
}) => {
  await page.goto("/en/esim/japan");
  await expect(page.locator(".plan-option")).toHaveCount(23);
  await expect(page.getByRole("button", { name: /Daily data/ })).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("Daily data");
  await expect(page.locator(".selected-plan-price")).toContainText(/USD/);
  await page.locator(".plan-filter-disclosure summary").click();
  await page.getByLabel("Data allowance").selectOption("50");
  await page.getByLabel("Duration", { exact: true }).selectOption("7");
  await expect(page.locator(".empty-state")).toBeVisible();
  await page.getByRole("button", { name: "Reset filters" }).first().click();
  const radio = page.getByRole("radio").nth(1);
  await radio.check();
  await expect(radio).toBeChecked();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(
    page.getByRole("region", { name: "Full plan details", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/en\/esim\/japan\?plan=/);
});
test("empty search, FAQ, and equivalent informational routes work", async ({
  page,
}) => {
  await page.goto("/en");
  const input = page.getByRole("combobox", { name: "Where are you headed?" });
  await input.fill("no-such-place");
  await expect(page.getByRole("status")).toContainText("No destinations found");
  await input.press("Escape");
  await expect(input).toHaveAttribute("aria-expanded", "false");
  await expect(input).toHaveValue("no-such-place");
  await page.goto("/en/faq");
  await page.getByRole("link", { name: /^Getting started/ }).click();
  await page.getByText("What is an eSIM?", { exact: true }).click();
  await expect(page.locator("details[open]")).toContainText(
    "digital SIM profile",
  );
  await page
    .getByLabel("Search questions")
    .fill("Can I share data with a hotspot?");
  await expect(page.locator(".faq-list details")).toHaveCount(0);
  await page.getByRole("link", { name: "All topics", exact: true }).click();
  await expect(page.locator(".faq-topic-selector > a")).toHaveCount(6);
  await page
    .getByLabel("Search questions")
    .fill("Can I share data with a hotspot?");
  await expect(page.locator(".faq-search-results a")).toHaveCount(1);
  await page.goto("/en/how-it-works");
  await page
    .getByRole("link", { name: "Change language: Español" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/es\/como-funciona/);
});
test("all public pages respond, invalid routes are 404 and SEO is localized", async ({
  request,
}) => {
  for (const route of [
    "/en",
    "/es",
    "/en/destinations",
    "/es/destinos",
    "/en/how-it-works",
    "/es/como-funciona",
    "/en/compatibility",
    "/es/compatibilidad",
    "/en/help",
    "/es/ayuda",
    "/en/faq",
    "/es/preguntas-frecuentes",
    "/en/terms",
    "/es/privacidad",
    "/en/refunds",
    "/en/esim/europe",
    "/es/esim/australia",
    "/robots.txt",
    "/sitemap.xml",
    "/opengraph-image",
  ]) {
    expect((await request.get(route)).status(), route).toBe(200);
  }
  expect((await request.get("/fr")).status()).toBe(404);
  expect((await request.get("/en/esim/unknown")).status()).toBe(404);
  const html = await (await request.get("/es/esim/japan")).text();
  expect(html).toContain('href="https://mytripsim.com/es/esim/japan"');
  expect(html).toContain('hrefLang="en"');
});
test("responsive layouts have no overflow, assets load and mobile navigation works", async ({
  page,
  isMobile,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const route of [
    "/en",
    "/es",
    "/es/destinos",
    "/es/esim/united-states",
    "/es/compatibilidad",
    "/es/preguntas-frecuentes",
  ]) {
    await page.goto(route);
    await expect(page.locator("h1")).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect
      .poll(() =>
        page
          .locator(".site-header")
          .evaluate((element) =>
            Math.round(element.getBoundingClientRect().top),
          ),
      )
      .toBe(0);
    const widths = await page.evaluate(() => ({
      page: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(widths.page, route).toBeLessThanOrEqual(widths.viewport);
    for (const image of await page.locator("main img").all()) {
      await image.scrollIntoViewIfNeeded();
      await expect(image).toBeVisible();
      await expect
        .poll(() =>
          image.evaluate(
            (element) => (element as HTMLImageElement).naturalWidth,
          ),
        )
        .toBeGreaterThan(0);
    }
  }
  if (isMobile) {
    await page.getByRole("button", { name: "Abrir navegación" }).click();
    await page
      .locator("#mobile-navigation")
      .getByRole("link", { name: "Destinos", exact: true })
      .click();
    await expect(page).toHaveURL(/\/es\/destinos/);
  }
  expect(errors).toEqual([]);
});
