import { expect, test } from "@playwright/test";

test("a catalog plan connects to cart, guest checkout and the account gate", async ({
  page,
}) => {
  await page.goto("/en/esim/japan");
  await expect(
    page.getByRole("region", { name: "Full plan details", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Japan");
  await expect(page.locator(".selected-plan-price")).toContainText(/USD/);
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  const cart = page.getByRole("dialog", { name: /Your cart/ });
  await expect(cart.locator(".cart-item")).toHaveCount(1);
  await cart.getByRole("link", { name: "Continue to checkout" }).click();
  await expect(page).toHaveURL(/\/en\/checkout$/);
  await expect(page.getByLabel("Email address")).toBeEditable();
  await expect(
    page.getByRole("button", { name: "Continue to payment" }),
  ).toBeDisabled();
  await expect(page.locator('input[autocomplete="cc-number"]')).toHaveCount(0);
  await page.getByRole("link", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/en\/sign-in/);
  await expect(page.locator("#account-email")).toBeVisible();
  await expect(page.locator(".esim-pass")).toHaveCount(0);
});

test("private wallet requires sign in and public installation guidance remains bilingual", async ({
  page,
}) => {
  await page.goto("/es/mis-esim");
  await expect(page).toHaveURL(/\/es\/iniciar-sesion/);
  await expect(page.locator("#account-email")).toBeVisible();
  await page.goto("/es/instalar");
  await page.getByRole("button", { name: "Android", exact: true }).click();
  await expect(page.locator(".install-steps")).toContainText("Redes");
  await page.goto("/es/estudio");
  await page.getByRole("button", { name: "Pedidos", exact: true }).click();
  await expect(page.locator("main")).toContainText("DEMO-");
  await page.getByRole("button", { name: "Destinos", exact: true }).click();
  await page.getByLabel("Buscar en destinos").fill("Japón");
  await expect(page.locator(".studio-row")).toHaveCount(1);
  await page.goto("/es/crear-cuenta");
  await expect(page.locator("#account-confirm")).toBeVisible();
});

test("preview pages protect plan identity, locale context and indexing", async ({
  page,
  request,
}) => {
  const html = await (await request.get("/en/esim/japan")).text();
  const id = html.match(/data-plan-id="([^"]+)"/)?.[1];
  expect(id).toBeTruthy();
  const encoded = encodeURIComponent(id!);
  expect((await request.get(`/en/plan/france/${encoded}`)).status()).toBe(404);
  expect((await request.get("/en/plan/japan/not-a-plan")).status()).toBe(404);
  expect((await request.get("/en/plan/japan/JP_0.5_Daily")).status()).toBe(404);
  expect(
    (
      await request.get("/en/checkout?destination=japan&plan=JP_0.5_Daily")
    ).status(),
  ).toBe(404);
  expect((await request.get("/en/esim/china-mainland-and-hk")).status()).toBe(
    404,
  );
  expect(await (await request.get("/sitemap.xml")).text()).not.toContain(
    "china-mainland-and-hk",
  );
  expect(
    (
      await request.get(`/en/checkout?destination=france&plan=${encoded}`)
    ).status(),
  ).toBe(404);
  const gated = await request.get("/es/mis-esim?esim=unknown");
  expect(gated.url()).toContain("/es/iniciar-sesion");
  for (const path of [
    "/en/checkout",
    "/en/my-esims",
    "/es/instalar",
    "/es/estudio",
  ]) {
    const response = await request.get(path);
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain('content="noindex, nofollow"');
  }
  await page.goto(`/en/checkout?destination=japan&plan=${encoded}`);
  await expect(
    page.getByRole("link", { name: "Change language: Español" }).first(),
  ).toHaveAttribute("href", `/es/compra?destination=japan&plan=${encoded}`);
  await page
    .getByRole("link", { name: "Change language: Español" })
    .first()
    .click();
  await expect(page).toHaveURL(
    new RegExp(`/es/compra\\?destination=japan&plan=${encoded}`),
  );
  await expect(page.locator(".checkout-summary .cart-item")).toContainText(
    "Japón",
  );
  await page.goto("/en/sign-in");
  await page
    .getByRole("link", { name: "Change language: Español" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/es\/iniciar-sesion/);
});

test("visual workspace and traveler screens fit small phones through desktop", async ({
  page,
}) => {
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      "/es/mis-esim",
      "/es/mis-esim?esim=trip-france",
      "/es/instalar",
      "/es/estudio",
      "/es/compra",
    ]) {
      await page.goto(path);
      const dimensions = await page.evaluate(() => ({
        content: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      expect(dimensions.content, `${path} at ${width}px`).toBeLessThanOrEqual(
        dimensions.viewport,
      );
    }
  }
});
