import { expect, test } from "@playwright/test";

test("plan variants switch operators, activation and APN without leaking commercial data", async ({
  page,
}) => {
  await page.goto("/en/esim/japan?plan=JP_1_7");
  const sheet = page.getByRole("region", {
    name: "Full plan details",
    exact: true,
  });
  await expect(sheet).toContainText("On the first network connection");
  await expect(sheet.locator(".plan-network-table")).toContainText("SoftBank");
  await expect(sheet.locator(".plan-network-table")).toContainText(
    "Rakuten Mobile",
  );
  await sheet.getByText("APN settings", { exact: true }).click();
  await expect(sheet.locator("code")).toHaveText("mobile.three.com.hk");
  await page.locator('input[type="radio"][value="JP_1_7_IIJ"]').check();
  await expect(sheet.locator(".plan-network-table tbody tr")).toHaveCount(1);
  await expect(sheet.locator(".plan-network-table tbody")).toHaveText(
    "NTT docomo5G",
  );
  await expect(sheet.locator("code")).toHaveText("vmobile.jp");
  await page.locator('input[type="radio"][value="JP_0.1_7"]').check();
  await expect(sheet).toContainText("When the eSIM is installed");
  await expect(sheet).not.toContainText(/[$€£]|\bUSD\b/);
  expect(await page.content()).not.toMatch(
    /Price\(USD\)|Variant Price|PRIVATE_PROVIDER_ID/,
  );
});

test("regional sheets expose actual included destinations and grouped local operators", async ({
  page,
}) => {
  await page.goto("/es/esim/europe");
  const sheet = page.getByRole("region", {
    name: "Ficha completa del plan",
    exact: true,
  });
  await sheet
    .locator("summary")
    .filter({ hasText: "Países y territorios incluidos" })
    .click();
  await expect(sheet.locator(".plan-coverage-list li").first()).toBeVisible();
  expect(await sheet.locator(".plan-coverage-list li").count()).toBeGreaterThan(
    5,
  );
  await sheet.getByText("Operadores por destino", { exact: true }).click();
  await expect(
    sheet.locator('.plan-regional-networks th[scope="rowgroup"]').first(),
  ).toBeVisible();
  for (const image of await sheet.locator(".plan-coverage-list img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((el) => (el as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(sheet).not.toContainText(/[$€£]|\bUSD\b/);
  await page.goto("/en/esim/caribbean-20-areas?plan=CB-25_1_7");
  await page
    .locator("summary")
    .filter({ hasText: "Included countries and territories" })
    .click();
  const legacy = page
    .locator(".plan-coverage-list li")
    .filter({ has: page.locator('img[src="/flags/an.svg"]') });
  await expect(legacy).toContainText(
    "Netherlands Antilles (AN): needs confirmation",
  );
  await expect(legacy).not.toContainText("Curaçao");
});

test("ambiguous source technologies are qualified and fair use does not become unlimited data", async ({
  page,
}) => {
  await page.goto("/es/esim/afghanistan?plan=AF_1_7");
  await expect(page.locator(".plan-network-caution")).toContainText(
    "pendiente de confirmar",
  );
  await page.goto("/es/esim/canada?plan=CA_75_30");
  await expect(page.locator(".selected-plan-conditions")).toContainText(
    "128 Kbps",
  );
  await expect(page.locator(".selected-plan-stats")).toContainText("75GB");
  await expect(page.locator(".selected-plan-tag")).toHaveText("Datos fijos");
});
