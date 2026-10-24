import { expect, test } from "@playwright/test";
import catalog from "../../src/data/plans.json" with { type: "json" };

test("plans sort numerically and selection survives reload and translation without a dialog", async ({
  page,
}) => {
  await page.goto("/en/esim/japan");
  const ids = () =>
    page
      .locator(".plan-option input")
      .evaluateAll((inputs) =>
        inputs.map((input) => (input as HTMLInputElement).value),
      );
  const expected = [...catalog.japan].sort(
    (a, b) =>
      a.dataGb - b.dataGb || a.days - b.days || a.id.localeCompare(b.id),
  );
  expect(await ids()).toEqual(expected.map((plan) => plan.id));
  await page.getByLabel("Sort by", { exact: true }).selectOption("days");
  expect(await ids()).toEqual(
    [...catalog.japan]
      .sort(
        (a, b) =>
          a.days - b.days || a.dataGb - b.dataGb || a.id.localeCompare(b.id),
      )
      .map((plan) => plan.id),
  );
  const selected = catalog.japan.find(
    (plan) => plan.dataGb === 5 && plan.days === 30,
  )!;
  const radio = page.locator(`input[type="radio"][value="${selected.id}"]`);
  await radio.check();
  await expect(page).toHaveURL(
    new RegExp(`plan=${encodeURIComponent(selected.id)}`),
  );
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".selected-plan-stats")).toContainText(
    selected.allowance,
  );
  await expect(page.locator(".selected-plan-stats")).toContainText(
    `${selected.days} days`,
  );
  await expect(
    page.getByRole("link", { name: "Preview purchase" }),
  ).toHaveAttribute(
    "href",
    `/en/checkout?destination=japan&plan=${encodeURIComponent(selected.id)}`,
  );
  await page.reload();
  await expect(radio).toBeChecked();
  const language = page
    .getByRole("link", { name: "Change language: Español" })
    .first();
  await expect(language).toHaveAttribute(
    "href",
    `/es/esim/japan?plan=${encodeURIComponent(selected.id)}`,
  );
  await language.click();
  await expect(radio).toBeChecked();
  await expect(page.locator(".selected-plan-stats")).toContainText("30 días");
});

test("filters replace a hidden selection and empty matches never keep stale purchase links", async ({
  page,
}) => {
  await page.goto("/en/esim/japan");
  await page.getByLabel("Data allowance").selectOption("5");
  await page.getByLabel("Duration", { exact: true }).selectOption("30");
  const selectedId = await page
    .locator(".plan-option input:checked")
    .inputValue();
  await expect(
    page.getByRole("link", { name: "Preview purchase" }),
  ).toHaveAttribute("href", new RegExp(encodeURIComponent(selectedId)));
  await page.getByLabel("Data allowance").selectOption("50");
  await page.getByLabel("Duration", { exact: true }).selectOption("7");
  await expect(
    page.getByRole("link", { name: "Preview purchase" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "Full plan details", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Reset filters" }).first().click();
  await expect(page.locator(".plan-option input:checked")).toHaveCount(1);
});

test("search focus surrounds the whole field and changing models clears previous device checks", async ({
  page,
}) => {
  await page.goto("/en/compatibility");
  await page
    .getByRole("button", { name: "Check compatibility", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Apple · iPhone" }).click();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  const search = dialog.getByLabel("Search models");
  await search.fill("iPhone 16");
  await expect(search).toHaveCSS("outline-style", "none");
  await expect(dialog.locator(".compat-search")).toHaveCSS(
    "border-color",
    "rgb(22, 119, 255)",
  );
  const contentBox = await dialog.locator(".compat-content").boundingBox();
  const footerBox = await dialog.locator(".compat-footer").boundingBox();
  expect(contentBox!.y + contentBox!.height).toBeLessThanOrEqual(
    footerBox!.y + 1,
  );
  await dialog
    .getByRole("button", { name: "iPhone 16 Documented support", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByLabel("Where did you buy your device?").selectOption("es");
  for (const group of await dialog.locator("fieldset.compat-question").all())
    await group.getByLabel("Yes", { exact: true }).check();
  await dialog.getByRole("button", { name: "Back", exact: true }).click();
  await search.fill("iPhone 15");
  await dialog
    .getByRole("button", { name: "iPhone 15 Documented support", exact: true })
    .click();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(dialog.getByLabel("Where did you buy your device?")).toHaveValue(
    "",
  );
  await expect(dialog.locator('input[type="radio"]:checked')).toHaveCount(0);
  await expect(
    dialog.getByRole("button", { name: "See result" }),
  ).toBeDisabled();
});
