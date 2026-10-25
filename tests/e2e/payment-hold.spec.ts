import { test, expect } from "@playwright/test";
test("payment hold shows SIM, keeps a fixed five-minute clock and cancels without clearing the cart", async ({
  page,
}) => {
  const id = "88888888-8888-4888-8888-888888888888",
    epoch = Date.now();
  const lines = [
    { destination: "united-states", planId: "US_1_7_usip", quantity: 1 },
  ];
  await page.clock.install({ time: epoch });
  await page.addInitScript(
    (cart) => localStorage.setItem("mytripsim.cart.v1", JSON.stringify(cart)),
    lines,
  );
  let expired = false;
  await page.route("**/api/checkout/status?**", (route) =>
    route.fulfill({
      json: {
        id,
        status: expired ? "cancelled" : "pending",
        total: 300,
        currency: "usd",
        test: true,
        holdExpiresAt: new Date(epoch + 300000).toISOString(),
        serverTime: new Date(epoch).toISOString(),
        paymentInProgress: false,
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
      },
    }),
  );
  await page.goto(`/es/checkout/result?order=${id}`);
  await expect(
    page.getByRole("heading", { name: "Completar el pago", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("timer")).toHaveText("05:00");
  await expect(
    page.getByAltText(/SIM junto a una tarjeta y un reloj de arena/),
  ).toBeVisible();
  await page.clock.fastForward(299000);
  await expect(page.getByRole("timer")).toHaveText("00:01");
  expired = true;
  await page.clock.fastForward(2000);
  await expect(
    page.getByRole("heading", { name: "Pedido cancelado", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Completar el pago", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("mytripsim.cart.v1")!),
    ),
  ).toEqual(lines);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Pedido cancelado", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
