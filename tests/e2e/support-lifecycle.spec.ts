import { expect, test } from "@playwright/test";
import { mockMessenger } from "./support-fixture";
for (const locale of ["es", "en"] as const) {
  test(`support ${locale}: resolves, rates and starts an independent new issue`, async ({
    page,
  }) => {
    const es = locale === "es",
      state = await mockMessenger(page, false);
    await page.goto(`/${locale}`);
    await page
      .getByRole("button", {
        name: es
          ? "Hablar con SIM, asistente de ayuda"
          : "Chat with SIM, help assistant",
      })
      .click();
    await page
      .getByRole("button", {
        name: es ? "Instalar mi eSIM" : "Install my eSIM",
        exact: true,
      })
      .click();
    const composer = page.getByRole("textbox", {
      name: es ? "Tu mensaje" : "Your message",
      exact: true,
    });
    await composer.fill("Please help with installation");
    await page
      .getByRole("button", {
        name: es ? "Enviar mensaje" : "Send message",
        exact: true,
      })
      .click();
    await expect(
      page.getByText("Use a Wi-Fi connection to install your eSIM."),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: es ? "Cerrar incidencia" : "Close issue",
        exact: true,
      })
      .click();
    await expect(composer).toHaveCount(0);
    await page
      .getByRole("button", {
        name: es ? "5/5 · Excelente" : "5/5 · Excellent",
        exact: true,
      })
      .click();
    await page
      .getByLabel(
        es
          ? "¿Nos cuentas un poco más? (opcional)"
          : "Tell us a little more (optional)",
      )
      .fill("Very clear help");
    await page
      .getByRole("button", {
        name: es ? "Enviar valoración" : "Send feedback",
        exact: true,
      })
      .click();
    await expect(
      page.getByText(
        es ? "¡Gracias por tu valoración!" : "Thanks for your feedback!",
      ),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: es ? "Nueva consulta" : "New conversation",
        exact: true,
      })
      .click();
    await page
      .getByRole("button", {
        name: es ? "Elegir un plan" : "Choose a plan",
        exact: true,
      })
      .click();
    await expect(composer).toHaveValue("");
    await expect(page.locator(".support-message")).toHaveCount(0);
    expect(state.threads).toHaveLength(2);
    expect(state.threads[1].rating).toBe(5);
    expect(state.threads[1].rating_comment).toBe("Very clear help");
    expect(state.threads[0].id).not.toBe(state.threads[1].id);
  });
}
test("guest conversation resumes after minimizing and expires after ten minutes without forcing a rating", async ({
  page,
}) => {
  await page.clock.install();
  const state = await mockMessenger(page, false);
  await page.goto("/en");
  const launcher = page.getByRole("button", {
    name: "Chat with SIM, help assistant",
  });
  await launcher.click();
  await page
    .getByRole("button", { name: "Something else", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Your message", exact: true })
    .fill("Can I share data?");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await expect(
    page.getByText("Use a Wi-Fi connection to install your eSIM."),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Minimize chat", exact: true })
    .click();
  state.advance(9 * 60000);
  await page.clock.fastForward(9 * 60000);
  await launcher.click();
  await expect(
    page.getByText("Can I share data?", { exact: true }),
  ).toBeVisible();
  state.advance(61000);
  await page.clock.fastForward(61000);
  await expect(
    page.getByRole("heading", { name: "This issue is closed", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Your message", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "New conversation", exact: true })
    .click();
  await page
    .getByRole("button", { name: "I cannot connect", exact: true })
    .click();
  expect(state.threads).toHaveLength(2);
  expect(state.threads[1].rating).toBeNull();
  expect(state.threads[1].close_reason).toBe("inactivity");
});
