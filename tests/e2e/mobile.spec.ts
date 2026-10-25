import { expect, test } from "@playwright/test";

test("app navigation reflects localized routes and stays clear of footer", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/es");
  const nav = page.getByRole("navigation", { name: "Navegación principal" });
  await expect(nav).toBeVisible();
  await expect(nav.getByRole("link", { name: "Inicio" })).toHaveAttribute(
    "aria-current",
    "page",
  );
  for (const link of await nav.getByRole("link").all()) {
    const box = await link.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  await nav.getByRole("link", { name: "Destinos" }).click();
  await expect(page).toHaveURL(/\/es\/destinos/);
  await page.getByLabel("¿Cuál es tu próximo destino?").fill("japón");
  await page.locator('.destination-card[href="/es/esim/japan"]').click();
  await expect(nav.getByRole("link", { name: "Destinos" })).toHaveAttribute(
    "aria-current",
    "location",
  );
  await page.locator(".footer-bottom").scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const footer = await page.locator(".footer-bottom").boundingBox();
  const dock = await nav.boundingBox();
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(dock!.y + 1);
  await nav.getByRole("link", { name: "Ayuda" }).click();
  await expect(page).toHaveURL(/\/es\/ayuda/);
  await page
    .getByRole("link", { name: "Cambiar idioma: English" })
    .first()
    .click();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Help" }),
  ).toHaveAttribute("aria-current", "page");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await expect(page.locator(".mobile-bottom-nav")).not.toBeVisible();
});

test("phone search remains usable in a short viewport and dock returns after editing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/es");
  const input = page.getByRole("combobox", {
    name: "¿Cuál es tu próximo destino?",
  });
  await expect(input).toHaveCSS("font-size", "16px");
  await input.fill("japón");
  await expect(page.locator(".mobile-bottom-nav")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 430 });
  await expect(page.locator(".mobile-bottom-nav")).not.toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(input).toBeFocused();
  await expect(page.locator(".mobile-bottom-nav")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 430 });
  await input.scrollIntoViewIfNeeded();
  await expect(page.getByRole("option", { name: "Japón" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Japón" })).toBeInViewport();
  await input.press("ArrowDown");
  await input.press("Enter");
  await expect(page).toHaveURL(/\/es\/esim\/japan/);
  await expect(page.locator(".mobile-bottom-nav")).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/es/destinos");
  const directory = page.getByLabel("¿Cuál es tu próximo destino?");
  await directory.fill("japón");
  await expect(page.locator(".destination-card")).toHaveCount(1);
  await directory.press("Enter");
  await expect(page.locator(".mobile-bottom-nav")).toBeVisible();
});

test("phone plan selection keeps complete details on the same page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en/esim/japan");
  const radio = page.getByRole("radio").nth(2);
  await radio.check();
  await expect(radio).toBeChecked();
  await expect(page.locator("body")).not.toHaveCSS("overflow", "hidden");
  await page.locator(".plan-purchase-summary").scrollIntoViewIfNeeded();
  const details = page.getByRole("region", {
    name: "Full plan details",
    exact: true,
  });
  await expect(details).toBeInViewport();
  await expect(details).not.toContainText(/USD\s*\d/);
  await expect(page.getByRole("tab")).toHaveCount(0);
});

test("small phones, tablets and landscape layouts do not overflow", async ({
  page,
}) => {
  for (const [width, height] of [
    [320, 740],
    [360, 800],
    [430, 932],
    [768, 1024],
    [844, 390],
  ]) {
    await page.setViewportSize({ width, height });
    for (const path of [
      "/es",
      "/es/destinos",
      "/es/esim/united-states",
      "/es/preguntas-frecuentes",
      "/es/ayuda",
    ]) {
      await page.goto(path);
      const dimensions = await page.evaluate(() => ({
        content: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      expect(dimensions.content, `${path} at ${width}px`).toBeLessThanOrEqual(
        dimensions.viewport,
      );
      await expect(page.locator(".mobile-bottom-nav")).toBeVisible();
    }
  }
});
