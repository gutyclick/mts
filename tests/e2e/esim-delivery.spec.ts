import { test, expect } from "@playwright/test";
import QRCode from "qrcode";
const id = "66666666-6666-4666-8666-666666666666",
  token = "a".repeat(64);
test("guest delivery provides a private QR, manual installation and mobile layout without an account", async ({
  page,
}) => {
  const qr = await QRCode.toDataURL("DEMO-NOT-AN-ESIM");
  await page.route("**/api/esims/access", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ id, token });
    await route.fulfill({
      json: {
        units: [
          {
            id,
            state: "sent",
            name: "Panamá 100 MB · 7 días",
            unitIndex: 1,
            qr,
            smdpAddress: "rsp.example.com",
            activationCode:
              "DEMO_ONLY_LONG_PRIVATE_CODE_123456789012345678901234567890",
            apn: "example.apn",
          },
        ],
      },
    });
  });
  await page.goto(`/es/esim/access#${id}.${token}`);
  await expect(
    page.getByRole("heading", { name: "Tu viaje empieza aquí." }),
  ).toBeVisible();
  await expect(
    page.getByAltText("QR privado de instalación de tu eSIM"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copiar código de activación" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Descargar QR" }),
  ).toHaveAttribute("download", `MyTripSim-${id.slice(0, 8)}.png`);
  await expect(
    page.getByText("Enviada al correo del beneficiario."),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
test("invalid guest links expose no installation details and offer retry", async ({
  page,
}) => {
  await page.route("**/api/esims/access", (route) =>
    route.fulfill({ status: 404, json: { error: "delivery_unavailable" } }),
  );
  await page.goto(`/en/esim/access#${id}.${token}`);
  await expect(page.locator(".esim-delivery").getByRole("alert")).toContainText(
    "We couldn’t open your eSIM.",
  );
  await expect(page.getByRole("link", { name: "Download QR" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});
test("email problems keep an already issued guest eSIM available", async ({
  page,
}) => {
  const qr = await QRCode.toDataURL("DEMO-NOT-AN-ESIM");
  await page.route("**/api/esims/access", (route) =>
    route.fulfill({
      json: {
        units: [
          {
            id,
            state: "review",
            installationReady: true,
            name: "Panamá 100 MB",
            unitIndex: 1,
            qr,
            smdpAddress: "rsp.example.com",
            activationCode: "DEMO_ONLY",
          },
        ],
      },
    }),
  );
  await page.goto(`/es/esim/access#${id}.${token}`);
  await expect(
    page.getByAltText("QR privado de instalación de tu eSIM"),
  ).toBeVisible();
  await expect(
    page.getByText(
      "Tu QR está disponible. El envío del correo necesita revisión.",
    ),
  ).toBeVisible();
});
