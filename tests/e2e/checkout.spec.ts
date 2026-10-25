import { test, expect } from "@playwright/test";

const order = "99999999-9999-4999-8999-999999999999";
const lines = [
  { destination: "united-states", planId: "US_1_7_usip", quantity: 2 },
  { destination: "japan", planId: "JP_1_7", quantity: 1 },
];
const receipt = {
  id: order,
  status: "pending",
  total: 300,
  currency: "usd",
  test: true,
  items: [
    {
      plan_id: "US_1_7_usip",
      destination_slug: "united-states",
      destination_name: { es: "Estados Unidos", en: "United States" },
      plan_name: "United States 1GB 7Days USIP",
      data_gb: 1,
      days: 7,
      quantity: 1,
      unit_amount: 300,
    },
  ],
};

test("checkout keeps email private, requires consent and handles a payment outage", async ({
  page,
}) => {
  await page.addInitScript(
    (cart) => localStorage.setItem("mytripsim.cart.v1", JSON.stringify(cart)),
    lines,
  );
  await page.route("**/api/checkout/config", (route) =>
    route.fulfill({ json: { enabled: true, mode: "test" } }),
  );
  let submitted: Record<string, unknown> | undefined;
  await page.route("**/api/checkout/session", (route) => {
    submitted = route.request().postDataJSON();
    return route.fulfill({
      status: 503,
      json: { error: "payments_unavailable" },
    });
  });
  await page.goto("/es/compra");
  await expect(
    page.getByText("Modo de pruebas · sin cargos reales", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Correo electrónico")
    .fill("private-guest@example.invalid");
  const button = page.getByRole("button", {
    name: "Continuar al pago de prueba",
  });
  await expect(button).toBeDisabled();
  await page.locator('input[name="compatible"]').check();
  await expect(button).toBeDisabled();
  await page.locator('input[name="terms"]').check();
  await expect(button).toBeEnabled();
  await button.click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Tu carrito sigue guardado",
  );
  expect(submitted?.lines).toEqual(lines);
  expect(submitted?.terms).toBe(true);
  expect(submitted?.compatible).toBe(true);
  expect(Object.keys(submitted!).sort()).toEqual([
    "attemptId",
    "compatible",
    "email",
    "expectedTotal",
    "lines",
    "locale",
    "terms",
  ]);
  const storage = await page.evaluate(() => JSON.stringify(localStorage));
  expect(storage).not.toContain("private-guest");
  await expect(button).toBeEnabled();
});

test("receipt waits for confirmation and consumes purchased quantities once", async ({
  page,
}) => {
  await page.goto("/es/compra");
  await page.evaluate(
    (cart) => localStorage.setItem("mytripsim.cart.v1", JSON.stringify(cart)),
    lines,
  );
  let polls = 0;
  await page.route("**/api/checkout/status?**", (route) =>
    route.fulfill({
      json: { ...receipt, status: ++polls === 1 ? "pending" : "paid" },
    }),
  );
  await page.goto(`/es/checkout/result?order=${order}`);
  await expect(
    page.getByRole("heading", { name: "Estamos comprobando tu pago" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("mytripsim.cart.v1")!),
    ),
  ).toEqual(lines);
  await expect(
    page.getByRole("heading", { name: "Pago de prueba confirmado" }),
  ).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByText(/no se han hecho cargos ni emitido eSIM reales/),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        JSON.parse(localStorage.getItem("mytripsim.cart.v1")!),
      ),
    )
    .toEqual([{ ...lines[0], quantity: 1 }, lines[1]]);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Pago de prueba confirmado" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("mytripsim.cart.v1")!),
    ),
  ).toEqual([{ ...lines[0], quantity: 1 }, lines[1]]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("header .language-switch").click();
  await expect(page).toHaveURL(
    new RegExp(`/en/checkout/result\\?order=${order}`),
  );
  await expect(
    page.getByRole("heading", { name: "Test payment confirmed" }),
  ).toBeVisible();
});

test("a cancelled payment leaves the cart intact and offers a return", async ({
  page,
}) => {
  await page.addInitScript(
    (cart) => localStorage.setItem("mytripsim.cart.v1", JSON.stringify(cart)),
    lines,
  );
  await page.route("**/api/checkout/status?**", (route) =>
    route.fulfill({ json: receipt }),
  );
  await page.goto(`/en/checkout/result?order=${order}&cancelled=1`);
  await expect(
    page.getByRole("heading", { name: "Your payment isn’t complete" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("mytripsim.cart.v1")!),
    ),
  ).toEqual(lines);
  await page.getByRole("link", { name: "Back to my cart" }).click();
  await expect(page).toHaveURL(/\/en\/checkout$/);
  await expect(page.locator(".checkout-summary .cart-item")).toHaveCount(2);
});
