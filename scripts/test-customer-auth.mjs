// Explicit live integration test. Creates isolated, disposable private fixtures;
// never sends email, never prints passwords/tokens, and removes its own users.
import { spawnSync } from "node:child_process";
import { loadEnvFile } from "node:process";
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium, expect } from "@playwright/test";

loadEnvFile(".env.local");
const result = spawnSync(
  process.env.ComSpec || "cmd.exe",
  [
    "/d",
    "/s",
    "/c",
    "npx.cmd --yes supabase projects api-keys --project-ref xfdwqalkkjclburzcwlv --reveal --output json",
  ],
  { encoding: "utf8", maxBuffer: 1024 * 1024 },
);
if (result.status !== 0)
  throw new Error(
    "Authenticated Supabase CLI required for account integration tests",
  );
const keys = JSON.parse(result.stdout);
const key = keys.find(
  (k) => k.type === "secret" && k.api_key.startsWith("sb_secret_"),
)?.api_key;
if (!key)
  throw new Error("Could not obtain a temporary in-memory admin test client");
const admin = createClient(process.env.SUPABASE_URL, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY;
const base = process.env.ACCOUNTS_TEST_BASE || "http://localhost:3000";
const nonce = randomBytes(10).toString("hex");
const password = randomBytes(24).toString("base64url") + "aA9!";
const newPassword = randomBytes(24).toString("base64url") + "bB8!";
const ids = [];
let stage = "setup",
  browser,
  failed = false;
function check(error) {
  if (error) throw new Error("Backend test operation failed");
}
async function login(page, email, pass, locale = "es") {
  await page.goto(
    base + (locale === "es" ? "/es/iniciar-sesion" : "/en/sign-in"),
  );
  await page.locator("#account-email").fill(email);
  await page.locator("#account-password").fill(pass);
  await page.locator(".account-submit").click();
  await expect(page).toHaveURL(
    new RegExp(locale === "es" ? "/es/mis-esim" : "/en/my-esims"),
  );
}
async function auditPrivatePage(page) {
  await page.addScriptTag({ path: "node_modules/axe-core/axe.min.js" });
  const violations = await page.evaluate(async () =>
    (
      await window.axe.run(document.querySelector("main"), {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"],
        },
      })
    ).violations.map((v) => v.id),
  );
  if (violations.length)
    throw new Error("Private accessibility findings: " + violations.join(","));
}
try {
  const users = [];
  for (let i = 0; i < 3; i++) {
    const email = `qa-mts-${nonce}-${i}@example.invalid`;
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { locale: "es" },
    });
    check(error);
    ids.push(data.user.id);
    users.push({ id: data.user.id, email });
  }
  const records = [];
  for (let i = 0; i < 2; i++) {
    const { data: order, error } = await admin
      .from("customer_orders")
      .insert({
        user_id: users[i].id,
        status: "completed",
        destination_name: {
          es: i ? "Francia" : "Japón",
          en: i ? "France" : "Japan",
        },
        destination_slug: i ? "france" : "japan",
        plan_id: "QA_PRIVATE",
        plan_name: `QA private ${i}`,
        data_gb: 1,
        days: 7,
      })
      .select("id")
      .single();
    check(error);
    const { data: esim, error: esimError } = await admin
      .from("customer_esims")
      .insert({
        user_id: users[i].id,
        order_id: order.id,
        status: "ready",
        smdp_address: "qa.example.invalid",
        activation_code: `QA_PRIVATE_${i}_${nonce}`,
        iccid: `QA_${i}_${nonce}`,
      })
      .select("id")
      .single();
    check(esimError);
    records.push(esim);
  }
  stage = "live RLS";
  const client = createClient(process.env.SUPABASE_URL, publicKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  check(
    (await client.auth.signInWithPassword({ email: users[0].email, password }))
      .error,
  );
  const own = await client.from("customer_orders").select("user_id");
  check(own.error);
  if (own.data.length !== 1 || own.data[0].user_id !== users[0].id)
    throw new Error("Owner isolation failed");
  const foreign = await client
    .from("customer_esims")
    .select("activation_code")
    .eq("id", records[1].id);
  check(foreign.error);
  if (foreign.data.length) throw new Error("Foreign eSIM was exposed");
  const mutation = await client
    .from("customer_orders")
    .update({ status: "cancelled" })
    .eq("id", records[0].id);
  if (!mutation.error || mutation.error.code !== "42501")
    throw new Error("Customer mutation was allowed");
  browser = await chromium.launch({ channel: "msedge", headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  stage = "anonymous gate and login";
  await page.goto(base + "/es/mis-esim");
  await expect(page).toHaveURL(/iniciar-sesion/);
  await login(page, users[0].email, password);
  await expect(page.locator(".customer-esim-grid article")).toHaveCount(1);
  const cookie = (await context.cookies()).find(
    (c) => c.name.startsWith("sb-") && c.name.includes("auth-token"),
  );
  if (!cookie?.httpOnly) throw new Error("Session cookie is not HttpOnly");
  if ((await page.content()).includes(`QA_PRIVATE_0_${nonce}`))
    throw new Error("List exposed an installation code");
  stage = "private detail";
  await page.getByRole("link", { name: "Ver mi eSIM", exact: true }).click();
  await page
    .locator(".customer-disclosure summary")
    .filter({ hasText: "Mostrar QR" })
    .click();
  await expect(
    page.getByAltText("QR privado de instalación de tu eSIM"),
  ).toBeVisible();
  await auditPrivatePage(page);
  await expect(page.locator("main")).toContainText(`QA_PRIVATE_0_${nonce}`);
  if ((await page.content()).includes(`QA_PRIVATE_1_${nonce}`))
    throw new Error("Foreign installation code was exposed");
  const blocked = await page.goto(base + "/es/mis-esim?esim=" + records[1].id);
  if (
    blocked.status() !== 404 ||
    (await page.content()).includes(`QA_PRIVATE_1_${nonce}`)
  )
    throw new Error("Foreign detail was accessible");
  stage = "logout";
  await page.goto(base + "/es/mis-esim");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/iniciar-sesion/);
  await page.goto(base + "/es/mis-esim");
  await expect(page).toHaveURL(/iniciar-sesion/);
  stage = "second account";
  await login(page, users[1].email, password, "en");
  await expect(page.locator(".customer-esim-grid article")).toHaveCount(1);
  await expect(page.locator("main")).not.toContainText("QA private 0");
  await page.getByRole("button", { name: "Sign out" }).click();
  stage = "empty account";
  await login(page, users[2].email, password);
  await expect(
    page.getByRole("heading", { name: "Tu próximo viaje te espera" }),
  ).toBeVisible();
  await auditPrivatePage(page);
  await expect(page.locator(".customer-esim-grid article")).toHaveCount(0);
  mkdirSync("docs/previews", { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/previews/account-wallet-empty-mobile.png",
    fullPage: true,
    mask: [page.locator(".customer-heading p:not(.eyebrow)")],
    maskColor: "#eaf1f9",
  });
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  stage = "password recovery";
  const recovery = await admin.auth.admin.generateLink({
    type: "recovery",
    email: users[0].email,
  });
  check(recovery.error);
  await page.goto(
    `${base}/es/auth/confirm?type=recovery&token_hash=${recovery.data.properties.hashed_token}`,
  );
  await expect(page).toHaveURL(/nueva-contrasena$/);
  await page.locator("#account-password").fill(newPassword);
  await page.locator("#account-confirm").fill(newPassword);
  await page.locator(".account-submit").click();
  await expect(page).toHaveURL(/mis-esim$/);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await page.goto(
    `${base}/es/auth/confirm?type=recovery&token_hash=${recovery.data.properties.hashed_token}`,
  );
  await expect(page).toHaveURL(/iniciar-sesion\?error=link$/);
  await expect(page.locator('.account-message[role="alert"]')).toBeVisible();
  await login(page, users[0].email, newPassword);
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  stage = "signup confirmation";
  const signup = await admin.auth.admin.generateLink({
    type: "signup",
    email: `qa-mts-${nonce}-new@example.invalid`,
    password,
    options: { data: { locale: "es" } },
  });
  check(signup.error);
  ids.push(signup.data.user.id);
  await page.goto(
    `${base}/es/auth/confirm?type=signup&token_hash=${signup.data.properties.hashed_token}`,
  );
  await expect(page).toHaveURL(/mis-esim$/);
  await expect(
    page.getByRole("heading", { name: "Tu próximo viaje te espera" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  stage = "mobile auth and redirects";
  await page.goto(base + "/es/iniciar-sesion?next=https://evil.example");
  await page.setViewportSize({ width: 320, height: 844 });
  if (
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    )
  )
    throw new Error("Auth page overflow");
  await page.screenshot({
    path: "docs/previews/account-login-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({
    path: "docs/previews/account-login-desktop.png",
    fullPage: true,
  });
  console.log(
    "PASS: live ownership, private QR, login, HttpOnly cookies, logout, empty account, recovery, reused token rejection, signup confirmation and mobile layout. No emails sent.",
  );
} catch (error) {
  failed = true;
  console.error("Account integration failed at stage: " + stage);
  const safe = String(error?.message ?? "Unknown failure")
    .replaceAll(password, "[redacted]")
    .replaceAll(newPassword, "[redacted]")
    .replace(/token_hash=[^\s&"')]+/g, "token_hash=[redacted]")
    .replace(/sb_(secret|publishable)_[A-Za-z0-9_-]+/g, "[redacted]");
  console.error(safe.slice(0, 1400));
} finally {
  await browser?.close();
  for (const id of ids) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      failed = true;
      console.error("Disposable account cleanup failed; retry required.");
    }
  }
  console.log("Disposable account cleanup completed. No credentials printed.");
}
if (failed) process.exitCode = 1;
