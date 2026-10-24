import { expect, test } from "@playwright/test";

test("plan information and a complete compatibility journey share one screen", async ({
  page,
}) => {
  await page.goto("/en/esim/japan");
  await expect(
    page.getByRole("region", { name: "Full plan details", exact: true }),
  ).toBeVisible();
  const launch = page.getByRole("button", {
    name: "Check compatibility",
    exact: true,
  });
  await launch.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { level: 2 })).toBeFocused();
  await expect(
    dialog.getByRole("button", { name: "Continue", exact: true }),
  ).toBeDisabled();
  await dialog.getByRole("button", { name: "Apple · iPhone" }).click();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByLabel("Search models").fill("iPhone 16");
  await dialog
    .getByRole("button", { name: "iPhone 16 Documented", exact: false })
    .click();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByLabel("Where did you buy your device?").selectOption("es");
  await dialog
    .getByRole("group", { name: "Is it unlocked for other carriers?" })
    .getByLabel("Yes", { exact: true })
    .check();
  await dialog
    .getByRole("group", { name: "Can you see “Add eSIM” in Settings?" })
    .getByLabel("Yes", { exact: true })
    .check();
  await dialog.getByRole("button", { name: "See result" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Your model supports eSIM" }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("link", { name: "Apple · iPhone eSIM" }),
  ).toHaveAttribute("href", "https://support.apple.com/en-us/118669");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(launch).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe(
    "hidden",
  );
});

test("unlisted devices and carrier locks never produce approval", async ({
  page,
}) => {
  await page.goto("/en/compatibility");
  await page
    .getByRole("button", { name: "Check compatibility", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("More brands").selectOption("Huawei");
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByLabel("Search models").fill("no-such-model");
  await expect(
    dialog.getByText("We couldn't find that model.", { exact: false }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "My model is not listed" }).click();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog
    .getByLabel("Where did you buy your device?")
    .selectOption("other");
  await dialog
    .getByRole("group", { name: "Is it unlocked for other carriers?" })
    .getByLabel("No", { exact: true })
    .check();
  await dialog
    .getByRole("group", { name: "Can you see “Add eSIM” in Settings?" })
    .getByLabel("Yes", { exact: true })
    .check();
  await dialog.getByRole("button", { name: "See result" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Unlock your device first" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Check another device" }).click();
  await dialog.getByRole("button", { name: "Google Pixel" }).click();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByRole("button", { name: "My model is not listed" }).click();
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  await dialog.getByLabel("Where did you buy your device?").selectOption("us");
  for (const group of await dialog.locator("fieldset.compat-question").all())
    await group.getByLabel("Yes", { exact: true }).check();
  await dialog.getByRole("button", { name: "See result" }).click();
  await expect(
    dialog.getByRole("heading", { name: "Your variant needs confirmation" }),
  ).toBeVisible();
});

test("Spanish onboarding fits a narrow mobile viewport", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 650 });
  await page.goto("/es/compatibilidad");
  await page.getByRole("button", { name: "Verificar compatibilidad" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "¿Qué marca viaja contigo?" }),
  ).toBeVisible();
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(
    true,
  );
  await dialog.getByRole("button", { name: "Samsung" }).click();
  await dialog.getByRole("button", { name: "Continuar", exact: true }).click();
  await dialog.getByLabel("Buscar modelo").fill("A74");
  await expect(
    dialog.getByRole("button", { name: "Galaxy A74 5G Pendiente" }),
  ).toBeVisible();
});
