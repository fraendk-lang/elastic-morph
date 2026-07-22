// @ts-check
const { test, expect } = require("@playwright/test");

test.describe("Elastic Morph smoke", () => {
  test("landing page loads with CTA", async ({ page }) => {
    await page.goto("/index.html");
    await expect(page.locator("h1")).toContainText(/ELASTIC/i);
    await expect(page.locator('a.pill.primary[href="elastic-morph.html"]').first()).toBeVisible();
  });

  test("app shell and creator dock present", async ({ page }) => {
    await page.goto("/elastic-morph.html");
    await expect(page.locator("#app")).toBeVisible();
    await expect(page.locator("#creatorDock")).toBeAttached();
    await expect(page.locator("#creatorExport")).toBeAttached();
  });

  test("welcome or canvas visible on first visit", async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.removeItem("elasticMorph.welcomed");
    });
    await page.goto("/elastic-morph.html");
    const welcome = page.locator("#welcomeOverlay");
    await expect(welcome).toBeVisible({ timeout: 10000 });
  });
});
