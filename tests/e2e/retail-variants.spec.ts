import { test, expect } from "@playwright/test";
import prices from "../../src/data/retail-prices.json" with { type: "json" };
import catalog from "../../src/data/plans.json" with { type: "json" };
test("plan cards contain all variant, price and duration text at narrow and wide sizes", async ({
  page,
}) => {
  const highest = Object.entries(prices).sort((a, b) => b[1] - a[1])[0][0];
  const destination = Object.entries(catalog).find(([, plans]) =>
    plans.some((p) => p.id === highest),
  )![0];
  for (const slug of ["united-states", destination]) {
    await page.goto(`/en/esim/${slug}`);
    for (const width of [320, 390, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      const overflow = await page
        .locator(".plan-option")
        .evaluateAll((cards) =>
          cards
            .filter(
              (card) =>
                card.scrollHeight > card.clientHeight + 1 ||
                card.scrollWidth > card.clientWidth + 1,
            )
            .map((card) => card.getAttribute("data-plan-id")),
        );
      expect(overflow, `${slug} at ${width}px`).toEqual([]);
    }
  }
});
test("named variants keep their own selling price through selection, tooltip, cart and checkout", async ({
  page,
}) => {
  await page.goto("/en/esim/united-states?plan=US_1_7_usip");
  await expect(
    page.locator('.plan-option[data-plan-id="US_1_7_usip"]'),
  ).toContainText("USIP");
  await expect(page.locator(".selected-plan-price")).toHaveText(
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      currencyDisplay: "code",
    }).format(prices.US_1_7_usip / 100),
  );
  await page.getByRole("button", { name: "About USIP", exact: true }).click();
  await expect(page.getByRole("tooltip")).toContainText("United States IP");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await page.getByRole("button", { name: "Add to cart", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: /Your cart/ });
  await expect(dialog.locator(".cart-variant-name")).toHaveText("USIP");
  await dialog.getByRole("button", { name: "Increase quantity" }).click();
  const total = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    currencyDisplay: "code",
  }).format((prices.US_1_7_usip * 2) / 100);
  await expect(dialog.locator(".cart-price-pending")).toHaveText(total);
  await dialog.getByRole("link", { name: "Continue to checkout" }).click();
  await expect(page.locator(".checkout-total strong")).toHaveText(total);
  await expect(
    page.getByRole("button", { name: "Continue to payment", exact: true }),
  ).toBeDisabled();
});
