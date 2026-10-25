import { expect, test } from "@playwright/test";

test("account gate preserves safe private destinations and never renders fictional trips", async ({
  page,
}) => {
  const id = "11111111-1111-4111-8111-111111111111";
  await page.goto("/es/mis-esim?esim=" + id);
  await expect(page).toHaveURL(/iniciar-sesion/);
  expect(new URL(page.url()).searchParams.get("next")).toBe(
    "/es/mis-esim?esim=" + id,
  );
  await expect(page.locator(".esim-pass")).toHaveCount(0);
  await expect(page.getByLabel("Correo electrónico")).toBeVisible();
  await page.goto("/en/sign-in?next=https://evil.example");
  await expect(page.locator('input[name="next"]')).toHaveValue("/en/my-esims");
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, nofollow",
  );
});

test("registration validates matching passwords without sending email and password visibility is accessible", async ({
  page,
}) => {
  await page.goto("/es/crear-cuenta");
  await page
    .getByLabel("Correo electrónico")
    .fill("account-validation@example.invalid");
  await page.locator("#account-password").fill("Long passphrase A123");
  await page.locator("#account-confirm").fill("Long passphrase B456");
  await page.getByRole("button", { name: "Mostrar contraseña" }).click();
  await expect(page.locator("#account-password")).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Ocultar contraseña" }).click();
  await expect(page.locator("#account-password")).toHaveAttribute(
    "type",
    "password",
  );
  await page
    .getByRole("button", { name: "Crear mi cuenta", exact: true })
    .click();
  await expect(page.locator('.account-message[role="alert"]')).toContainText(
    "confirma la misma contraseña",
  );
});

test("password recovery and confirmation reject missing sessions and invalid links", async ({
  page,
}) => {
  await page.goto("/es/nueva-contrasena");
  await expect(page.locator("#account-password")).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "Solicitar un enlace" }),
  ).toHaveAttribute("href", "/es/recuperar-contrasena");
  await page.goto("/en/auth/confirm?type=recovery&token_hash=invalid");
  await expect(page).toHaveURL(/\/en\/sign-in\?error=link$/);
  await expect(page.locator('.account-message[role="alert"]')).toContainText(
    "invalid",
  );
});
