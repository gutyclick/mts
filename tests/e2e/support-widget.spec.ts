import { expect, test } from "@playwright/test";

for (const locale of ["en", "es"] as const) {
  test(`support handoff ${locale}: one message creates the ticket, pauses chat and preserves failed submissions`, async ({
    page,
  }) => {
    const es = locale === "es",
      posts: Record<string, unknown>[] = [],
      ticket = "12345678-1234-4234-9234-123456789abc";
    let chatCalls = 0;
    await page.route("**/api/support/session", (route) =>
      route.fulfill({
        json: {
          authenticated: true,
          identity: "12345678-1234-4234-9234-123456789def",
          ai: true,
          orders: [],
          chatId: null,
        },
      }),
    );
    await page.route("**/api/support/chat", (route) => {
      chatCalls++;
      return route.fulfill({ status: 500, json: { error: "unexpected_chat" } });
    });
    await page.route("**/api/support/tickets", async (route) => {
      posts.push(route.request().postDataJSON());
      await route.fulfill(
        posts.length === 1
          ? { status: 503, json: { error: "unavailable" } }
          : { json: { id: ticket } },
      );
    });
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
        name: es ? "Necesito ayuda humana" : "I need human help",
      })
      .click();
    const card = page.locator(".support-human-card"),
      help = card.getByLabel(
        es ? "¿Con qué necesitas ayuda?" : "What do you need help with?",
      ),
      create = card.getByRole("button", {
        name: es ? "Crear ticket" : "Create ticket",
        exact: true,
      });
    await help.fill(
      es
        ? "No consigo conectarme con mi eSIM."
        : "I cannot connect with my eSIM.",
    );
    await expect(create).toBeEnabled();
    await expect(page.locator(".support-composer textarea")).toBeDisabled();
    await expect(page.locator(".support-composer button")).toBeDisabled();
    await create.click();
    await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
    await expect(help).not.toHaveValue("");
    await create.click();
    await expect(
      card.getByRole("heading", {
        name: es ? "Tu ticket está creado" : "Your ticket is ready",
      }),
    ).toBeVisible();
    expect(posts).toHaveLength(2);
    const first = posts[0].request as Record<string, unknown>,
      second = posts[1].request as Record<string, unknown>;
    expect(first.body).toBe(
      es
        ? "No consigo conectarme con mi eSIM."
        : "I cannot connect with my eSIM.",
    );
    expect(first.subject).toBe(first.body);
    expect(first.requestId).toBe(second.requestId);
    expect(chatCalls).toBe(0);
    await expect(
      card.getByRole("link", { name: es ? "Ver mi ticket" : "View my ticket" }),
    ).toHaveAttribute("href", `/${locale}/support?ticket=${ticket}`);
  });
}

test("returning from handoff restores the chat draft without submitting a ticket", async ({
  page,
}) => {
  await page.route("**/api/support/session", (route) =>
    route.fulfill({
      json: { authenticated: true, ai: true, orders: [], chatId: null },
    }),
  );
  await page.route("**/api/support/tickets", () => {
    throw new Error("No ticket should be sent");
  });
  await page.goto("/en");
  await page
    .getByRole("button", { name: "Chat with SIM, help assistant" })
    .click();
  const composer = page.locator(".support-composer textarea");
  await composer.fill("Please help me install my eSIM");
  await page.getByRole("button", { name: "I need human help" }).click();
  await expect(composer).toBeDisabled();
  await expect(page.getByLabel("What do you need help with?")).toHaveValue(
    "Please help me install my eSIM",
  );
  await page.getByRole("button", { name: "Back to chat" }).click();
  await expect(composer).toBeEditable();
  await expect(composer).toHaveValue("Please help me install my eSIM");
});
