import { test, expect } from "@playwright/test";

test("landing page loads and shows hero", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle(/Adswish/i);

  await expect(
    page.getByRole("heading", { name: /Discover creators who actually sell/i })
  ).toBeVisible();

  await expect(
    page.getByRole("link", { name: /Start a Campaign/i })
  ).toBeVisible();

  await expect(
    page.getByRole("link", { name: /Join as a Creator/i })
  ).toBeVisible();
});

test("landing page shows example campaigns", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Example campaigns")).toBeVisible();
  await expect(page.getByText("CREATORS EARNED").first()).toBeVisible();
});

test("landing page shows tool grid", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: /Everything you need to run creator campaigns/i,
    })
  ).toBeVisible();
});

test("landing page shows dark CTA", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: /Launch your first campaign today/i })
  ).toBeVisible();
});
