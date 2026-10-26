import { expect, test } from "@playwright/test";
for (const locale of ["es", "en"])
  test(`legal documents are navigable and readable in ${locale}`, async ({
    page,
  }) => {
    const paths =
      locale === "es"
        ? ["terminos", "privacidad", "reembolsos", "cookies"]
        : ["terms", "privacy", "refunds", "cookies"];
    for (const path of paths) {
      const response = await page.goto(`/${locale}/${path}`);
      expect(response?.status()).toBe(200);
      await expect(page.locator("h1")).toHaveCount(1);
      await expect(page.locator(".legal-document > section")).not.toHaveCount(
        0,
      );
      await expect(page.locator(".legal-navigation a")).toHaveCount(4);
      await expect(page.locator(".legal-seller")).toContainText(
        "YellowCat Enterprises LLC",
      );
      await expect(page.locator(".legal-seller")).toContainText(
        "1209 Mountain Road Pl NE",
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > innerWidth,
        ),
      ).toBe(false);
      const first = page.locator(".legal-index a").first();
      await first.click();
      await expect(page).toHaveURL(/#section-1$/);
    }
    await expect(
      page
        .locator(".site-footer")
        .getByRole("link", { name: "Cookies", exact: true }),
    ).toHaveAttribute("href", `/${locale}/cookies`);
  });
