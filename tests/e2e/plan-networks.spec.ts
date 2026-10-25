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
  await expect(sheet.locator(".plan-essential-facts")).toBeVisible();
  await expect(sheet.locator(".plan-information")).not.toBeVisible();
  await expect(sheet.locator(".plan-essential-facts")).toContainText(
    "SoftBank",
  );
  await expect(sheet.locator(".plan-essential-facts")).toContainText(
    "3G / 4G / 5G",
  );
  await sheet.locator(".plan-technical-details > summary").click();
  await expect(sheet.locator(".plan-network-table")).toContainText("SoftBank");
  await expect(sheet.locator(".plan-network-table")).toContainText(
    "Rakuten Mobile",
  );
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
  await sheet.locator(".plan-technical-details > summary").click();
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
  await expect(page.locator(".plan-network-caution")).toBeVisible();
  await expect(page.locator(".plan-essential-facts")).toContainText("3G");
  await expect(page.locator(".plan-essential-facts")).not.toContainText("4G");
  await page.locator(".plan-technical-details > summary").click();
  await expect(page.locator(".plan-network-table")).toContainText("4G");
  await page.goto("/es/esim/canada?plan=CA_75_30");
  await expect(page.locator(".plan-fair-use")).toContainText("128 Kbps");
  await expect(page.locator(".plan-fair-use")).toBeVisible();
  await expect(page.locator(".selected-plan-stats")).toContainText("75GB");
  await expect(page.locator(".selected-plan-tag")).toHaveText("Datos fijos");
});
