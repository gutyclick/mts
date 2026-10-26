import { expect, test } from "@playwright/test";

const prototypeNotice =
  /modo de pruebas|pago de prueba|catálogo de prueba|compras (todavía|aún) no|demostración|test mode|test payment|preview catalog|purchases (are not|will come)/i;
for (const locale of ["es", "en"] as const) {
  test(`production checkout ${locale} uses purchase copy and keeps consent required`, async ({
    page,
  }) => {
    await page.addInitScript(() =>
      localStorage.setItem(
        "mytripsim.cart.v1",
        JSON.stringify([
          { destination: "panama", planId: "PA_0.1_7", quantity: 1 },
        ]),
      ),
    );
    await page.route("**/api/checkout/config", (route) =>
      route.fulfill({
        json: {
          enabled: true,
          mode: "live",
          publishableKey: "pk_live_fixture",
        },
      }),
    );
    await page.goto(locale === "es" ? "/es/compra" : "/en/checkout");
    const button = page.getByRole("button", {
      name: locale === "es" ? "Continuar al pago" : "Continue to payment",
      exact: true,
    });
    await expect(button).toBeVisible();
    await expect(page.locator("main")).not.toContainText(prototypeNotice);
    await expect(button).toBeDisabled();
    await page
      .locator('input[type="email"]')
      .first()
      .fill("production-check@example.invalid");
    await page.locator('input[name="compatible"]').check();
    await page.locator('input[name="terms"]').check();
    await expect(button).toBeEnabled();
  });
  test(`real receipt ${locale} does not label a confirmed purchase as a test`, async ({
    page,
  }) => {
    const id = "11111111-1111-4111-8111-111111111111";
    await page.route("**/api/checkout/status?**", (route) =>
      route.fulfill({
        json: {
          id,
          status: "paid",
          total: 300,
          currency: "usd",
          test: false,
          items: [],
        },
      }),
    );
    await page.route("**/api/checkout/esims?**", (route) =>
      route.fulfill({ json: { units: [] } }),
    );
    await page.goto(`/${locale}/checkout/result?order=${id}`);
    await expect(
      page.getByRole("heading", {
        name: locale === "es" ? "Pago confirmado" : "Payment confirmed",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.locator("main")).not.toContainText(prototypeNotice);
  });
}
