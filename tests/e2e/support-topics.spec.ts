import { expect, test } from "@playwright/test";
import { mockMessenger } from "./support-fixture";
const topics = {
  es: [
    ["Otra consulta", "Cuéntame qué necesitas resolver"],
    ["Instalar mi eSIM", "¿Qué modelo de teléfono tienes?"],
    ["No consigo conectarme", "¿En qué país estás y qué sucede"],
    ["Mi pedido o pago", "¿Qué necesitas resolver con el pago"],
    ["Mi teléfono", "¿Cuál es la marca y el modelo exacto"],
    ["Elegir un plan", "¿A qué país o países viajas y cuántos días estarás?"],
  ],
  en: [
    ["Something else", "Tell me what you need help with"],
    ["Install my eSIM", "What phone model do you have?"],
    ["I cannot connect", "Which country are you in"],
    ["My order or payment", "What do you need help with: your payment"],
    ["My phone", "What is its exact brand and model"],
    [
      "Choose a plan",
      "Which country or countries are you visiting, and how many days will you stay?",
    ],
  ],
} as const;
for (const locale of ["es", "en"] as const)
  test(`every support topic opens its own conversation in ${locale}`, async ({
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
    for (const [label, question] of topics[locale]) {
      await page.getByRole("button", { name: label, exact: true }).click();
      await expect(page.locator(".support-welcome")).toContainText(question);
      await expect(page.locator(".support-suggestions")).toHaveCount(0);
      await expect(
        page.getByText("Hello, traveler! 👋", { exact: true }),
      ).toHaveCount(0);
      if (label === topics[locale][5][0]) {
        await page
          .getByRole("textbox", {
            name: es ? "Tu mensaje" : "Your message",
            exact: true,
          })
          .fill("Panama, 7 days");
        await page
          .getByRole("button", {
            name: es ? "Enviar mensaje" : "Send message",
            exact: true,
          })
          .click();
        await expect(
          page.getByText("Use a Wi-Fi connection to install your eSIM."),
        ).toBeVisible();
        await expect(page.locator(".support-welcome")).toContainText(question);
        expect(state.threads[0].topic).toBe("plans");
      }
      await page
        .getByRole("button", {
          name: es ? "Cerrar incidencia" : "Close issue",
          exact: true,
        })
        .click();
      await page
        .getByRole("button", {
          name: es ? "Nueva consulta" : "New conversation",
          exact: true,
        })
        .click();
    }
    expect(state.threads).toHaveLength(6);
  });
