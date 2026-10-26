// Isolated live Supabase fixtures; all queued notices are deleted before cleanup.
// No provider provisioning, payment or email is triggered by this test.
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
process.loadEnvFile(".env.local");
const db = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_CHECKOUT_SECRET_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  ),
  base = process.env.SUPPORT_TEST_BASE || "http://localhost:3008",
  password = randomBytes(24).toString("base64url") + "aA9!",
  nonce = randomBytes(8).toString("hex"),
  users = [],
  order = randomUUID();
let browser,
  stage = "setup",
  failed = false;
const check = (e) => {
  if (e) throw new Error("Fixture operation failed");
};
async function login(page, email, next) {
  await page.goto(`${base}/es/iniciar-sesion?next=${encodeURIComponent(next)}`);
  await page.locator("#account-email").fill(email);
  await page.locator("#account-password").fill(password);
  await page.locator(".account-submit").click();
  await expect(page).toHaveURL((u) => u.pathname === next.split("?")[0], {
    timeout: 30000,
  });
}
async function post(context, url, request) {
  return context.request.post(base + url, {
    headers: { Origin: base },
    data: request,
  });
}
async function audit(page, selector) {
  await page.locator(selector).evaluate(async (el) => {
    await Promise.all(
      el
        .getAnimations({ subtree: true })
        .filter((a) => a.effect?.getTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => {})),
    );
  });
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const issues = await page.evaluate(
    async (s) =>
      (
        await window.axe.run(document.querySelector(s), {
          runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] },
        })
      ).violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => ({
          target: n.target,
          summary: n.failureSummary,
        })),
      })),
    selector,
  );
  if (issues.length)
    throw new Error("Accessibility: " + JSON.stringify(issues));
}
try {
  const worker = await db.rpc("support_worker_running");
  check(worker.error);
  if (worker.data)
    throw new Error(
      "Use an isolated database: production notification worker is running.",
    );
  for (const name of ["customer", "staff"]) {
    const r = await db.auth.admin.createUser({
      email: `qa-support-${name}-${nonce}@example.invalid`,
      password,
      email_confirm: true,
    });
    check(r.error);
    users.push(r.data.user);
  }
  check(
    (await db.from("admin_memberships").insert({ user_id: users[1].id })).error,
  );
  check(
    (
      await db.from("checkout_orders").insert({
        id: order,
        user_id: users[0].id,
        recipient_email: users[0].email,
        browser_hash: "a".repeat(64),
        ip_hash: "b".repeat(64),
        fingerprint: "c".repeat(64),
        locale: "es",
        amount_total: 100,
        status: "paid",
      })
    ).error,
  );
  check(
    (
      await db.from("checkout_order_items").insert({
        order_id: order,
        plan_id: "QA_SUPPORT",
        destination_slug: "panama",
        destination_name: { es: "Panamá", en: "Panama" },
        plan_name: "QA · Panamá 100 MB",
        data_gb: 0.1,
        days: 7,
        quantity: 1,
        unit_amount: 100,
        stripe_price_id: "price_qa_support",
      })
    ).error,
  );
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const guest = await browser.newContext(),
    customer = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    }),
    staff = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    p = await customer.newPage(),
    a = await staff.newPage(),
    g = await guest.newPage();
  stage = "anonymous privacy";
  expect(
    (await guest.request.get(base + "/api/support/tickets")).status(),
  ).toBe(401);
  expect(
    (await guest.request.get(base + "/api/admin/support/tickets")).status(),
  ).toBe(401);
  expect(
    (
      await post(guest, "/api/support/chat", {
        requestId: randomUUID(),
        message: "Private order",
        locale: "es",
        orderId: order,
      })
    ).status(),
  ).toBe(401);
  await g.goto(base + "/es");
  await g
    .getByRole("button", { name: "Hablar con SIM, asistente de ayuda" })
    .click();
  await expect(g.getByRole("dialog")).toBeVisible();
  await g.getByRole("button", { name: "Necesito ayuda humana" }).click();
  await expect(
    g.getByRole("link", { name: "Iniciar sesión y pedir ayuda" }),
  ).toBeVisible();
  await audit(g, ".support-dialog");
  await g.keyboard.press("Escape");
  await expect(g.getByRole("dialog")).not.toBeVisible();
  stage = "customer login and ownership";
  await login(p, users[0].email, "/es/support");
  expect(
    (await customer.request.get(base + "/api/admin/support/tickets")).status(),
  ).toBe(403);
  const foreign = await post(customer, "/api/support/chat", {
    requestId: randomUUID(),
    message: "Show order",
    locale: "es",
    orderId: randomUUID(),
  });
  expect(foreign.status()).toBe(404);
  const context = await customer.request.get(
    base + `/api/support/context?order=${order}`,
  );
  expect(context.status()).toBe(200);
  expect(JSON.stringify(await context.json())).not.toMatch(
    /activation_code|iccid|stripe_payment|recipient_email/,
  );
  stage = "chat and handoff";
  await p
    .getByRole("button", { name: "Hablar con SIM, asistente de ayuda" })
    .click();
  await expect(p.getByRole("dialog")).toBeVisible();
  await p.getByLabel("Sobre un pedido").selectOption(order);
  await p
    .getByLabel("Tu mensaje", { exact: true })
    .fill("Necesito ayuda con la instalación de mi eSIM");
  await p.getByRole("button", { name: "Enviar mensaje", exact: true }).click();
  await expect(p.locator(".support-message").last()).toBeVisible({
    timeout: 40000,
  });
  await p.getByRole("button", { name: "Cerrar chat", exact: true }).click();
  await p
    .getByRole("button", { name: "Hablar con SIM, asistente de ayuda" })
    .click();
  await expect(p.getByLabel("Sobre un pedido")).toHaveValue(order, {
    timeout: 20000,
  });
  await p.getByRole("button", { name: "Necesito ayuda humana" }).click();
  await p
    .getByLabel("¿Con qué necesitas ayuda?")
    .fill("QA · Ayuda de instalación\nPrueba aislada del sistema de soporte.");
  await p.getByRole("button", { name: "Crear ticket", exact: true }).click();
  await expect(
    p.getByRole("heading", { name: "Tu ticket está creado" }),
  ).toBeVisible({ timeout: 30000 });
  await p.getByRole("link", { name: "Ver mi ticket", exact: true }).click();
  await expect(p.locator(".support-ticket-heading h2")).toHaveText(
    "QA · Ayuda de instalación",
    { timeout: 20000 },
  );
  const ticket = new URL(p.url()).searchParams.get("ticket");
  expect(ticket).toBeTruthy();
  await audit(p, "main");
  mkdirSync("docs/previews", { recursive: true });
  await p.screenshot({
    path: "docs/previews/support-tickets-mobile.png",
    fullPage: true,
  });
  stage = "staff access and reply";
  await login(a, users[1].email, `/es/admin/tickets?ticket=${ticket}`);
  await expect(a.locator(".support-ticket-heading h2")).toHaveText(
    "QA · Ayuda de instalación",
    { timeout: 20000 },
  );
  await expect(a.locator(".site-header")).toHaveCount(0);
  await a
    .getByLabel("Tu respuesta", { exact: true })
    .fill("Respuesta de prueba: consulta la guía antes de borrar tu eSIM.");
  await a.getByRole("button", { name: "Enviar respuesta" }).click();
  await expect(a.locator(".support-message-agent")).toHaveCount(1, {
    timeout: 20000,
  });
  await a.getByRole("button", { name: "Marcar resuelto" }).click();
  await expect(a.locator(".support-ticket-heading .support-status")).toHaveText(
    "Resuelto",
  );
  await audit(a, "main");
  await a.screenshot({
    path: "docs/previews/support-admin-desktop.png",
    fullPage: true,
  });
  stage = "reopen and notification recipients";
  await p.reload();
  await expect(p.locator(".support-message-agent")).toHaveCount(1, {
    timeout: 20000,
  });
  await p
    .getByLabel("¿Necesitas algo más? Tu respuesta reabrirá el ticket.")
    .fill("Gracias, sigo necesitando ayuda.");
  await p.getByRole("button", { name: "Enviar respuesta" }).click();
  await expect(p.locator(".support-ticket-heading .support-status")).toHaveText(
    "En revisión",
  );
  const notices = await db
    .from("support_notifications")
    .select("recipient,kind")
    .eq("thread_id", ticket);
  check(notices.error);
  expect(notices.data).toHaveLength(3);
  expect(notices.data.find((n) => n.kind === "agent_reply").recipient).toBe(
    users[0].email,
  );
  expect(
    notices.data
      .filter((n) => n.kind !== "agent_reply")
      .every((n) => n.recipient === "hello@mytripsim.com"),
  ).toBe(true);
  const denied = await staff.request.get(
    base + `/api/support/tickets?id=${ticket}`,
  );
  expect(denied.status()).toBe(404);
  const csrf = await customer.request.post(base + "/api/support/tickets", {
    headers: { Origin: "https://evil.invalid" },
    data: { locale: "es", request: { action: "resolve", threadId: ticket } },
  });
  expect(csrf.status()).toBe(403);
  stage = "mobile widget";
  await p
    .getByRole("button", { name: "Hablar con SIM, asistente de ayuda" })
    .click();
  await expect(p.getByRole("dialog")).toBeVisible();
  await expect(p.getByRole("dialog")).toHaveCSS("width", "390px");
  await audit(p, ".support-dialog");
  await p.screenshot({ path: "docs/previews/support-chat-mobile.png" });
  await p.keyboard.press("Escape");
  console.log(
    "Support web checks passed: guest privacy, customer ownership, protected order context, chat handoff, ticket history, staff reply, resolution/reopening, CSRF, notification recipients and mobile/desktop accessibility. No email sent.",
  );
} catch (e) {
  failed = true;
  console.error(
    "Support web verification failed at " +
      stage +
      ": " +
      (e instanceof Error ? e.message.split("\n")[0] : "unknown"),
  );
} finally {
  await browser?.close();
  for (const user of users) {
    check(
      (await db.from("support_threads").delete().eq("user_id", user.id)).error,
    );
    check(
      (await db.from("admin_memberships").delete().eq("user_id", user.id))
        .error,
    );
  }
  check(
    (await db.from("checkout_order_items").delete().eq("order_id", order))
      .error,
  );
  check((await db.from("checkout_orders").delete().eq("id", order)).error);
  for (const user of users)
    check((await db.auth.admin.deleteUser(user.id)).error);
  if (failed) process.exitCode = 1;
}
