import { test, expect } from "@playwright/test";
test("administration and legacy demo routes require sign in and cannot expose data", async ({
  page,
  request,
}) => {
  for (const url of ["/es/admin", "/es/estudio"]) {
    await page.goto(url);
    await expect(page).toHaveURL(/\/es\/iniciar-sesion\?next=/);
    await expect(page.locator(".admin-workspace")).toHaveCount(0);
  }
  const response = await request.get("/api/admin/data?tab=users");
  expect(response.status()).toBe(401);
  expect(response.headers()["cache-control"]).toContain("no-store");
  expect(await response.text()).not.toContain("email");
  expect(
    (
      await request.post("/api/admin/action", {
        headers: { Origin: "https://foreign.invalid" },
        data: { action: "sync", id: "66666666-6666-4666-8666-666666666666" },
      })
    ).status(),
  ).toBe(403);
});
