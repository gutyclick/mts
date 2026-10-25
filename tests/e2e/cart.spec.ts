import { expect, test } from "@playwright/test";

test("cart persists selection and quantity, supports guest checkout and safely returns after sign in", async ({
  page,
}) => {
  await page.goto("/es/esim/japan");
  const chosen = await page.locator(".plan-option input:checked").inputValue();
  await page
    .getByRole("button", { name: "Añadir al carrito", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: /Tu carrito/ });
  await expect(dialog.locator(".cart-item")).toHaveCount(1);
  await dialog.getByRole("button", { name: "Aumentar cantidad" }).click();
  await expect(dialog.locator("output")).toHaveText("2");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Añadir al carrito", exact: true }),
  ).toBeFocused();
  await page.reload();
  await page.getByRole("button", { name: "Abrir carrito, 2 eSIM" }).click();
  await expect(dialog.locator("output")).toHaveText("2");
  await dialog.getByRole("link", { name: "Continuar con mi compra" }).click();
  await expect(page).toHaveURL(/\/es\/compra$/);
  await expect(
    page.getByLabel("Correo electrónico", { exact: true }),
  ).toBeEditable();
  await page
    .getByLabel("Correo electrónico", { exact: true })
    .fill("guest-private@example.invalid");
  await expect(
    page.getByRole("button", { name: "Continuar al pago" }),
  ).toBeDisabled();
  const stored = await page.evaluate(() =>
    localStorage.getItem("mytripsim.cart.v1"),
  );
  expect(JSON.parse(stored!)).toEqual([
    { destination: "japan", planId: chosen, quantity: 2 },
  ]);
  expect(stored).not.toContain("guest-private");
  await page.getByRole("link", { name: "Iniciar sesión", exact: true }).click();
  await expect(page.locator('input[name="next"]')).toHaveValue("/es/compra");
  await page.goto("/en/checkout");
  await expect(page.locator(".checkout-summary .cart-item")).toHaveCount(1);
  await expect(page.locator(".checkout-summary output")).toHaveText("2");
  await page.getByRole("button", { name: /^Remove Japan/ }).click();
  await expect(
    page
      .locator("main")
      .getByText("Your next trip starts here", { exact: true }),
  ).toBeVisible();
});

test("cart resolver rejects manipulated input and distinguishes unavailable plans", async ({
  request,
}) => {
  const endpoint = "/api/cart/resolve";
  for (const quantity of [0, -1, 11, 1.5])
    expect(
      (
        await request.post(endpoint, {
          data: [{ destination: "japan", planId: "JP_1_7", quantity }],
        })
      ).status(),
    ).toBe(400);
  expect(
    (
      await request.post(endpoint, {
        data: [
          { destination: "japan", planId: "JP_1_7", quantity: 1, price: 1 },
        ],
      })
    ).status(),
  ).toBe(400);
  expect(
    (
      await request.post(endpoint, {
        data: "broken",
        headers: { "Content-Type": "application/json" },
      })
    ).status(),
  ).toBe(400);
  const response = await request.post(endpoint, {
    data: [{ destination: "japan", planId: "nonexistent", quantity: 1 }],
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    items: [],
    unavailable: [{ destination: "japan", planId: "nonexistent", quantity: 1 }],
  });
  expect(response.headers()["cache-control"]).toContain("no-store");
});

test("a cart network failure preserves the selection and offers retry", async ({
  page,
}) => {
  await page.route("**/api/cart/resolve", (route) =>
    route.fulfill({ status: 503, body: "{}" }),
  );
  await page.goto("/en/esim/japan");
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /Your cart/ });
  await expect(dialog.getByRole("alert")).toContainText("still saved");
  await page.unroute("**/api/cart/resolve");
  await dialog.getByRole("button", { name: "Try again" }).click();
  await expect(dialog.locator(".cart-item")).toHaveCount(1);
});
