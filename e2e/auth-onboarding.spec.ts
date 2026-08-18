import { test, expect } from "@playwright/test";

test("signup page shows role selection and unchecked checkboxes", async ({ page }) => {
  await page.goto("/signup");

  await expect(
    page.getByRole("heading", { name: /Create your account/i })
  ).toBeVisible();

  await expect(page.getByText("Creator")).toBeVisible();
  await expect(page.getByText("Business")).toBeVisible();

  const msaCheckbox = page.locator("input[type=checkbox]").first();
  const privacyCheckbox = page.locator("input[type=checkbox]").nth(1);
  await expect(msaCheckbox).not.toBeChecked();
  await expect(privacyCheckbox).not.toBeChecked();
});

test("signup page blocks submission without role selection", async ({ page }) => {
  await page.goto("/signup");

  await page.fill('input[type=email]', 'test@example.com');
  await page.fill('input[type=password]', 'password123');

  await page.getByRole("button", { name: /Create account/i }).click();

  await expect(page.getByText(/Please select whether you are a creator or a business/i)).toBeVisible();
});

test("signup page blocks submission without checking both boxes", async ({ page }) => {
  await page.goto("/signup");

  await page.fill('input[type=email]', 'test@example.com');
  await page.fill('input[type=password]', 'password123');
  await page.getByText("Creator").click();

  await page.getByRole("button", { name: /Create account/i }).click();

  await expect(page.getByText(/You must agree to the Terms of Service and Privacy Policy/i)).toBeVisible();
});

test("login page renders correctly", async ({ page }) => {
  await page.goto("/login");

  await expect(
    page.getByRole("heading", { name: /Log in to Adswish/i })
  ).toBeVisible();

  await expect(page.locator('input[type=email]')).toBeVisible();
  await expect(page.locator('input[type=password]')).toBeVisible();

  await expect(page.getByRole("link", { name: /Sign up free/i })).toBeVisible();
});

test("login page redirects to signup", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: /Sign up free/i }).click();
  await expect(page).toHaveURL(/\/signup/);
});

test("verify-email page renders", async ({ page }) => {
  await page.goto("/verify-email");

  await expect(
    page.getByRole("heading", { name: /Verify your email/i })
  ).toBeVisible();
});

test("legal terms page renders", async ({ page }) => {
  await page.goto("/legal/terms");

  await expect(
    page.getByRole("heading", { name: /Terms of Service/i })
  ).toBeVisible();

  await expect(page.getByText("Master Service Agreement")).toBeVisible();
  await expect(page.getByText("10%")).toBeVisible();
});

test("legal privacy page renders", async ({ page }) => {
  await page.goto("/legal/privacy");

  await expect(
    page.getByRole("heading", { name: /Privacy Policy/i })
  ).toBeVisible();

  await expect(page.getByText("GDPR")).toBeVisible();
  await expect(page.getByText("Data Retention")).toBeVisible();
});

test("legal subprocessors page renders", async ({ page }) => {
  await page.goto("/legal/subprocessors");

  await expect(
    page.getByRole("heading", { name: /Subprocessors/i })
  ).toBeVisible();

  await expect(page.getByText("Supabase")).toBeVisible();
  await expect(page.getByText("Stripe")).toBeVisible();
});

test("cookie consent banner appears on landing page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/We use cookies to track attribution/i)).toBeVisible({ timeout: 5000 });
});

test("cookie consent banner can be dismissed", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Accept/i }).click();
  await expect(page.getByText(/We use cookies to track attribution/i)).not.toBeVisible();
});

test("unauthenticated dashboard redirects to login", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
});

test("unauthenticated onboarding redirects to login", async ({ page }) => {
  await page.goto("/onboarding");
  await expect(page).toHaveURL(/\/login/);
});
