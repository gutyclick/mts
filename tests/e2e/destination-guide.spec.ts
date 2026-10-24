import { expect, test } from "@playwright/test";

test("country guide uses catalog facts, native FAQs and a compact live purchase summary", async ({
  page,
}) => {
  await page.goto("/es/esim/germany");
  const guide = page.locator(".destination-guide");
  await expect(
    guide.getByRole("heading", { name: "Tu eSIM para Alemania", exact: true }),
  ).toBeVisible();
  const faq = guide
    .locator("details")
    .filter({ hasText: "¿Qué cobertura tiene la eSIM en Alemania?" });
  await faq.locator("summary").focus();
  await page.keyboard.press("Enter");
  await expect(faq.locator("p")).toContainText("Vodafone");
  await expect(faq.locator("p")).toContainText("O2");
  await expect(faq.locator("p")).toContainText("No todas las variantes");
  const description = await page
    .locator('meta[name="description"]')
    .getAttribute("content");
  expect(description).toContain("Alemania");
  expect(description).toContain("planes de datos fijos");
  await expect(
    page
      .getByRole("navigation", { name: "Ruta de navegación" })
      .locator('[aria-current="page"]'),
  ).toHaveText("Alemania");
  const summary = page.locator(".plan-purchase-summary");
  const details = page.locator(".plan-information");
  expect((await details.boundingBox())!.y).toBeGreaterThan(
    (await summary.boundingBox())!.y + (await summary.boundingBox())!.height,
  );
  await expect(
    details.locator(".selected-plan-conditions strong svg"),
  ).toHaveCount(5);
  await expect(
    details.getByRole("columnheader", { name: "Operador", exact: true }),
  ).toBeVisible();
  await expect(
    details.getByRole("columnheader", { name: "Red", exact: true }),
  ).toBeVisible();
  await page.goto("/en/esim/japan?plan=JP_1_7_IIJ");
  await expect(page.locator(".destination-guide")).toContainText("NTT docomo");
  await expect(page.locator(".destination-guide")).not.toContainText(
    "Vodafone",
  );
  await expect(page.locator(".plan-purchase-summary")).toContainText("1GB");
  await expect(page.locator(".plan-information")).toContainText("NTT docomo");
});
